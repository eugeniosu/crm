"use client";

import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardAction,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import { Switch } from "@crm/ui/components/switch";
import { ToggleGroup, ToggleGroupItem } from "@crm/ui/components/toggle-group";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";

type Settings = RouterOutputs["whatsappAssistant"]["settings"];
type Form = Pick<Settings, "enabled" | "ownerId" | "hours">;

const AUTOMATIC = "automatico";

const WEEKDAYS = [
	{ value: 1, label: "L", name: "lunes" },
	{ value: 2, label: "M", name: "martes" },
	{ value: 3, label: "M", name: "miércoles" },
	{ value: 4, label: "J", name: "jueves" },
	{ value: 5, label: "V", name: "viernes" },
	{ value: 6, label: "S", name: "sábado" },
	{ value: 0, label: "D", name: "domingo" },
];

const LENGTHS = [15, 30, 45, 60];

const NOTICES = [
	{ minutes: 0, label: "Sin anticipación" },
	{ minutes: 60, label: "1 hora" },
	{ minutes: 120, label: "2 horas" },
	{ minutes: 240, label: "4 horas" },
	{ minutes: 1440, label: "1 día" },
];

function toClock(minutes: number): string {
	return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:${String(minutes % 60).padStart(2, "0")}`;
}

function fromClock(value: string, fallback: number): number {
	const match = /^(\d{2}):(\d{2})$/.exec(value);
	if (!match) return fallback;
	return Number(match[1]) * 60 + Number(match[2]);
}

function same(a: Form, b: Form): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}

export function AssistantOperation() {
	const trpc = useTRPC();
	const settings = useQuery(trpc.whatsappAssistant.settings.queryOptions());
	if (!settings.data) return null;
	return (
		<OperationForm
			key={JSON.stringify(settings.data)}
			settings={settings.data}
		/>
	);
}

function OperationForm({ settings }: { settings: Settings }) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const saved: Form = {
		enabled: settings.enabled,
		ownerId: settings.ownerId,
		hours: settings.hours,
	};
	const [form, setForm] = useState<Form>(saved);
	const hours = form.hours;
	const setHours = (patch: Partial<Form["hours"]>) =>
		setForm({ ...form, hours: { ...hours, ...patch } });

	const save = useMutation(
		trpc.whatsappAssistant.updateSettings.mutationOptions({
			onSuccess: (data) => {
				queryClient.setQueryData(
					trpc.whatsappAssistant.settings.queryKey(),
					data,
				);
				toast.success("Cambios guardados.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const locked = !settings.canManage || save.isPending;
	const notices = NOTICES.some(
		(notice) => notice.minutes === hours.noticeMinutes,
	)
		? NOTICES
		: [
				...NOTICES,
				{
					minutes: hours.noticeMinutes,
					label: `${hours.noticeMinutes} minutos`,
				},
			];

	return (
		<Card>
			<CardHeader>
				<CardTitle>Funcionamiento</CardTitle>
				<CardDescription>
					Cuándo atiende, cuándo ofrece reuniones y a nombre de quién quedan los
					prospectos.
				</CardDescription>
				{settings.canManage ? (
					<CardAction>
						<Button
							disabled={locked || same(form, saved)}
							onClick={() => save.mutate(form)}
						>
							{save.isPending ? <Spinner data-icon="inline-start" /> : null}
							Guardar
						</Button>
					</CardAction>
				) : null}
			</CardHeader>
			<CardContent>
				<FieldGroup>
					<Field orientation="horizontal">
						<Switch
							id="assistant-enabled"
							checked={form.enabled}
							onCheckedChange={(enabled) => setForm({ ...form, enabled })}
							disabled={locked}
						/>
						<FieldLabel htmlFor="assistant-enabled">
							{form.enabled ? "Asistente encendido" : "Asistente apagado"}
						</FieldLabel>
					</Field>
					<FieldDescription className="-mt-2">
						Apagado, no responde nadie automáticamente: los mensajes siguen
						llegando a la app del teléfono.
					</FieldDescription>

					<Field>
						<FieldLabel htmlFor="assistant-owner">Responsable</FieldLabel>
						<Select
							value={form.ownerId ?? AUTOMATIC}
							onValueChange={(value) =>
								setForm({
									...form,
									ownerId: value === AUTOMATIC ? null : value,
								})
							}
							disabled={locked}
						>
							<SelectTrigger id="assistant-owner">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value={AUTOMATIC}>
									El primer usuario de la oficina
								</SelectItem>
								{settings.owners.map((owner) => (
									<SelectItem key={owner.id} value={owner.id}>
										{owner.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<FieldDescription>
							Los prospectos nuevos quedan a su nombre, y le llega una tarea
							cuando alguien pide hablar con una persona.
						</FieldDescription>
					</Field>

					<Field>
						<FieldLabel>Días de atención</FieldLabel>
						<ToggleGroup
							type="multiple"
							variant="outline"
							size="sm"
							spacing={0}
							value={hours.weekdays.map(String)}
							onValueChange={(values) =>
								setHours({ weekdays: values.map(Number) })
							}
							disabled={locked}
							aria-label="Días de atención"
						>
							{WEEKDAYS.map((day) => (
								<ToggleGroupItem
									key={day.value}
									value={String(day.value)}
									aria-label={day.name}
								>
									{day.label}
								</ToggleGroupItem>
							))}
						</ToggleGroup>
					</Field>

					<div className="grid grid-cols-2 gap-4">
						<Field>
							<FieldLabel htmlFor="assistant-open">Desde</FieldLabel>
							<Input
								id="assistant-open"
								type="time"
								step={900}
								value={toClock(hours.openMinute)}
								onChange={(event) =>
									setHours({
										openMinute: fromClock(event.target.value, hours.openMinute),
									})
								}
								disabled={locked}
							/>
						</Field>
						<Field>
							<FieldLabel htmlFor="assistant-close">Hasta</FieldLabel>
							<Input
								id="assistant-close"
								type="time"
								step={900}
								value={toClock(hours.closeMinute)}
								onChange={(event) =>
									setHours({
										closeMinute: fromClock(
											event.target.value,
											hours.closeMinute,
										),
									})
								}
								disabled={locked}
							/>
						</Field>
					</div>

					<div className="grid grid-cols-2 gap-4">
						<Field>
							<FieldLabel htmlFor="assistant-length">
								Duración de la reunión
							</FieldLabel>
							<Select
								value={String(hours.meetingMinutes)}
								onValueChange={(value) =>
									setHours({ meetingMinutes: Number(value) })
								}
								disabled={locked}
							>
								<SelectTrigger id="assistant-length">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{LENGTHS.map((minutes) => (
										<SelectItem key={minutes} value={String(minutes)}>
											{minutes} minutos
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
						<Field>
							<FieldLabel htmlFor="assistant-notice">
								Anticipación mínima
							</FieldLabel>
							<Select
								value={String(hours.noticeMinutes)}
								onValueChange={(value) =>
									setHours({ noticeMinutes: Number(value) })
								}
								disabled={locked}
							>
								<SelectTrigger id="assistant-notice">
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{notices.map((notice) => (
										<SelectItem
											key={notice.minutes}
											value={String(notice.minutes)}
										>
											{notice.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</Field>
					</div>
					<FieldDescription>
						Hora de Chile. El asistente solo ofrece reuniones dentro de este
						horario.
					</FieldDescription>
				</FieldGroup>
			</CardContent>
		</Card>
	);
}
