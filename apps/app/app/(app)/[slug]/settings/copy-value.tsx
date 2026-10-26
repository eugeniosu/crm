"use client";

import Copy from "@carbon/icons-react/es/Copy";
import { Button } from "@crm/ui/components/button";
import { Icon } from "@crm/ui/components/icon";
import { toast } from "sonner";

export function CopyValue({ value, label }: { value: string; label: string }) {
	const unavailable = () =>
		toast.error("No se pudo copiar. Selecciónalo y cópialo a mano.");

	return (
		<Button
			variant="ghost"
			size="icon"
			type="button"
			onClick={() => {
				const clipboard = navigator.clipboard;

				if (!clipboard) {
					unavailable();
					return;
				}

				clipboard
					.writeText(value)
					.then(() => toast.success("Copiado al portapapeles."))
					.catch(unavailable);
			}}
		>
			<Icon icon={Copy} />
			<span className="sr-only">Copiar {label}</span>
		</Button>
	);
}
