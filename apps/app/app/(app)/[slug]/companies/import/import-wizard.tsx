"use client";

import Upload from "@carbon/icons-react/es/Upload";
import { Alert, AlertDescription, AlertTitle } from "@crm/ui/components/alert";
import { Button } from "@crm/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardFooter,
	CardHeader,
	CardPanel,
	CardTitle,
} from "@crm/ui/components/card";
import {
	Field,
	FieldDescription,
	FieldGroup,
	FieldLabel,
} from "@crm/ui/components/field";
import { Icon } from "@crm/ui/components/icon";
import { Input } from "@crm/ui/components/input";
import {
	Select,
	SelectContent,
	SelectGroup,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@crm/ui/components/select";
import { Spinner } from "@crm/ui/components/spinner";
import {
	Table,
	TableBody,
	TableCaption,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@crm/ui/components/table";
import { COMPANY_IMPORT } from "@crm/validation/company-import";
import { useMutation } from "@tanstack/react-query";
import Link from "next/link";
import { useId, useReducer, useState } from "react";
import { useCrmCache } from "@/lib/trpc/cache";
import { useTRPC } from "@/lib/trpc/client";
import {
	buildImportRows,
	type CompanyImportField,
	type CompanyImportMapping,
	createInitialMapping,
	parseCsv,
	reduceImportWizard,
} from "./csv-import";

const IMPORT_FIELDS: Array<{
	value: CompanyImportField;
	label: string;
}> = [
	{ value: "name", label: "Nombre" },
	{ value: "website", label: "Sitio web o dominio" },
	{ value: "phone", label: "Teléfono" },
	{ value: "city", label: "Ciudad" },
	{ value: "stateCode", label: "Región o estado" },
	{ value: "industry", label: "Rubro" },
	{ value: "subIndustry", label: "Subrubro" },
	{ value: "description", label: "Descripción" },
];

const FIELD_LABELS = new Map(
	IMPORT_FIELDS.map((field) => [field.value, field.label]),
);
const SKIP = "skip";
const PREVIEW_ROWS = 5;

function focusElement(element: HTMLElement | null) {
	element?.focus();
}

export function ImportWizard({ companiesUrl }: { companiesUrl: string }) {
	const trpc = useTRPC();
	const cache = useCrmCache();
	const [state, dispatch] = useReducer(reduceImportWizard, {
		step: "upload",
		message: "Elige un archivo CSV.",
	});
	const [reading, setReading] = useState(false);

	const importCompanies = useMutation(
		trpc.companies.import.mutationOptions({
			onSuccess: async (result) => {
				if (result.created > 0) await cache.company();
				dispatch({ type: "import-finished", result });
			},
			onError: (error) => dispatch({ type: "failed", message: error.message }),
		}),
	);

	async function readFile(file: File) {
		setReading(true);
		try {
			if (file.size > COMPANY_IMPORT.maxFileBytes) {
				throw new Error("El archivo CSV pesa más de 5 MB.");
			}
			if (!file.name.toLowerCase().endsWith(".csv")) {
				throw new Error("Elige un archivo con extensión .csv.");
			}
			const parsed = parseCsv(await file.text());
			dispatch({
				type: "file-loaded",
				parsed,
				mapping: createInitialMapping(parsed.headers),
			});
		} catch (error) {
			dispatch({
				type: "failed",
				message:
					error instanceof Error
						? error.message
						: "No se pudo leer el archivo CSV.",
			});
		} finally {
			setReading(false);
		}
	}

	function startImport() {
		if (state.step !== "map") return;
		try {
			importCompanies.mutate({
				rows: buildImportRows(state.parsed, state.mapping),
			});
		} catch (error) {
			dispatch({
				type: "failed",
				message:
					error instanceof Error
						? error.message
						: "La asociación de columnas no es válida.",
			});
		}
	}

	return (
		<div className="flex w-full max-w-3xl flex-col gap-4">
			<p className="sr-only" role="status" aria-live="polite">
				{state.message}
			</p>
			{state.step === "upload" ? (
				<UploadStep error={state.error} reading={reading} onFile={readFile} />
			) : null}
			{state.step === "map" ? (
				<MapStep
					parsed={state.parsed}
					mapping={state.mapping}
					error={state.error}
					pending={importCompanies.isPending}
					onMappingChange={(column, field) =>
						dispatch({ type: "mapping-changed", column, field })
					}
					onBack={() => dispatch({ type: "back" })}
					onImport={startImport}
				/>
			) : null}
			{state.step === "result" ? (
				<ResultStep
					result={state.result}
					companiesUrl={companiesUrl}
					onRestart={() => dispatch({ type: "restart" })}
				/>
			) : null}
		</div>
	);
}

function UploadStep({
	error,
	reading,
	onFile,
}: {
	error?: string;
	reading: boolean;
	onFile: (file: File) => Promise<void>;
}) {
	const inputId = useId();
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 ref={focusElement} tabIndex={-1}>
						Elige un archivo CSV
					</h2>
				</CardTitle>
				<CardDescription>
					La primera fila debe tener los nombres de las columnas. El archivo
					puede tener hasta 5.000 empresas y debe pesar menos de 5 MB.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{error ? (
					<Alert variant="destructive">
						<AlertTitle>No se puede usar el archivo</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				<FieldGroup>
					<Field data-disabled={reading || undefined}>
						<FieldLabel htmlFor={inputId}>Archivo CSV</FieldLabel>
						<Input
							id={inputId}
							type="file"
							accept=".csv,text/csv"
							disabled={reading}
							onChange={(event) => {
								const file = event.currentTarget.files?.[0];
								event.currentTarget.value = "";
								if (file) void onFile(file);
							}}
						/>
						<FieldDescription>
							Podrás revisar cada columna antes de que empiece la importación.
						</FieldDescription>
					</Field>
				</FieldGroup>
			</CardContent>
			{reading ? (
				<CardFooter divider="none">
					<Spinner /> Leyendo el archivo
				</CardFooter>
			) : null}
		</Card>
	);
}

function MapStep({
	parsed,
	mapping,
	error,
	pending,
	onMappingChange,
	onBack,
	onImport,
}: {
	parsed: { headers: string[]; rows: string[][] };
	mapping: CompanyImportMapping;
	error?: string;
	pending: boolean;
	onMappingChange: (column: number, field: CompanyImportField | null) => void;
	onBack: () => void;
	onImport: () => void;
}) {
	const mappedColumns = mapping.flatMap((field, column) =>
		field ? [{ field, column, key: `${field}:${column}` }] : [],
	);
	const columns = parsed.headers.map((header, column) => ({
		header,
		column,
		key: `${header}:${column}`,
	}));
	const previewRows = parsed.rows
		.slice(0, PREVIEW_ROWS)
		.map((row, rowIndex) => ({
			row,
			key: `${row.join("\u0000")}:${rowIndex}`,
		}));
	const hasName = mapping.includes("name");
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 ref={focusElement} tabIndex={-1}>
						Asocia las columnas
					</h2>
				</CardTitle>
				<CardDescription>
					Cada campo de la empresa puede usar una columna del CSV. El nombre es
					obligatorio.
				</CardDescription>
			</CardHeader>
			<CardContent>
				{error ? (
					<Alert variant="destructive">
						<AlertTitle>No se puede iniciar la importación</AlertTitle>
						<AlertDescription>{error}</AlertDescription>
					</Alert>
				) : null}
				<CardPanel size="content">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Columna del CSV</TableHead>
								<TableHead>Campo de la empresa</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{columns.map(({ header, column, key }) => {
								const field = mapping[column] ?? null;
								const selectId = `company-import-column-${column}`;
								return (
									<TableRow key={key}>
										<TableCell>
											<FieldLabel htmlFor={selectId}>{header}</FieldLabel>
										</TableCell>
										<TableCell>
											<Select
												value={field ?? SKIP}
												onValueChange={(value) =>
													onMappingChange(
														column,
														value === SKIP
															? null
															: (value as CompanyImportField),
													)
												}
											>
												<SelectTrigger id={selectId} className="w-full">
													<SelectValue />
												</SelectTrigger>
												<SelectContent>
													<SelectGroup>
														<SelectItem value={SKIP}>No importar</SelectItem>
														{IMPORT_FIELDS.map((option) => (
															<SelectItem
																key={option.value}
																value={option.value}
																disabled={mapping.some(
																	(mapped, mappedColumn) =>
																		mappedColumn !== column &&
																		mapped === option.value,
																)}
															>
																{option.label}
															</SelectItem>
														))}
													</SelectGroup>
												</SelectContent>
											</Select>
										</TableCell>
									</TableRow>
								);
							})}
						</TableBody>
					</Table>
				</CardPanel>
				{mappedColumns.length > 0 ? (
					<CardPanel size="content">
						<Table>
							<TableCaption>
								Vista previa de {Math.min(PREVIEW_ROWS, parsed.rows.length)} de{" "}
								{parsed.rows.length} filas
							</TableCaption>
							<TableHeader>
								<TableRow>
									{mappedColumns.map(({ field, key }) => (
										<TableHead key={key}>{FIELD_LABELS.get(field)}</TableHead>
									))}
								</TableRow>
							</TableHeader>
							<TableBody>
								{previewRows.map(({ row, key }) => (
									<TableRow key={key}>
										{mappedColumns.map(({ column, key: columnKey }) => (
											<TableCell key={columnKey}>
												{row[column] || "Vacío"}
											</TableCell>
										))}
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardPanel>
				) : null}
			</CardContent>
			<CardFooter>
				<Button onClick={onImport} disabled={pending || !hasName}>
					{pending ? <Spinner data-icon="inline-start" /> : null}
					{pending ? "Importando" : `Importar ${parsed.rows.length} empresas`}
				</Button>
				<Button variant="outline" onClick={onBack} disabled={pending}>
					Atrás
				</Button>
			</CardFooter>
		</Card>
	);
}

function ResultStep({
	result,
	companiesUrl,
	onRestart,
}: {
	result: {
		created: number;
		skipped: number;
		skips: Array<{ row: number; reason: string }>;
	};
	companiesUrl: string;
	onRestart: () => void;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>
					<h2 ref={focusElement} tabIndex={-1}>
						Importación completa
					</h2>
				</CardTitle>
				<CardDescription>
					{result.created} empresas importadas. {result.skipped} filas omitidas.
				</CardDescription>
			</CardHeader>
			{result.skips.length > 0 ? (
				<CardContent>
					<Alert>
						<AlertTitle>Filas omitidas</AlertTitle>
						<AlertDescription>
							Corrige estas filas en el archivo CSV antes de volver a
							importarlas.
						</AlertDescription>
					</Alert>
					<CardPanel size="content">
						<Table>
							<TableHeader>
								<TableRow>
									<TableHead>Fila</TableHead>
									<TableHead>Motivo</TableHead>
								</TableRow>
							</TableHeader>
							<TableBody>
								{result.skips.map((skip) => (
									<TableRow key={skip.row}>
										<TableCell>{skip.row}</TableCell>
										<TableCell>{skip.reason}</TableCell>
									</TableRow>
								))}
							</TableBody>
						</Table>
					</CardPanel>
				</CardContent>
			) : null}
			<CardFooter divider={result.skips.length > 0 ? "top" : "none"}>
				<Button asChild>
					<Link href={companiesUrl}>Ver empresas</Link>
				</Button>
				<Button variant="outline" onClick={onRestart}>
					<Icon icon={Upload} data-icon="inline-start" />
					Importar otro archivo
				</Button>
			</CardFooter>
		</Card>
	);
}
