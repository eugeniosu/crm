import type { RecordKind } from "@/components/crm/record-sheet/record-stack";
import type { FieldEntity } from "./fields-entity";

export const SHEET_TITLE = "Campos";

const SUBTITLE = {
	company: "Esto define cada empresa de tu CRM.",
	contact: "Esto define cada contacto de tu CRM.",
	deal: "Esto define cada negocio de tu CRM.",
} satisfies Record<RecordKind, string>;

export function subtitleFor(kind: RecordKind): string {
	return SUBTITLE[kind];
}

export const STANDARD_ROW = "Campos estándar";
export const STANDARD_NOTE = "solo reordenar y ocultar";
export const SUGGESTED_ROW = "Campos sugeridos";
export const SUGGESTED_NOTE = "se agregan con un clic";
export const ADD = "Agregar";
export const CUSTOM_GROUP = "Campos personalizados";
export const DRAG_NOTE = "Arrastra para ordenar";
export const ARCHIVED_ROW = "Archivados";
export const ARCHIVED_NOTE =
	"los valores se conservan, ocultos en todas partes";
export const NEW_FIELD = "Nuevo campo";
export const ORDER_NOTE = "Este orden es el de la ficha";
export const MANUAL_ONLY = "Solo manual";
export const TABLE_NOTE = "también es una columna de la tabla";
export const FILTER_NOTE = "también es un filtro";

export const EMPTY_TITLE = "Todavía no hay campos personalizados";
export const EMPTY_BODY =
	"Crea campos dinámicos que tus agentes puedan investigar y rellenar.";

export const ERROR_TITLE = "No pudimos cargar tus campos";
export const ERROR_BODY =
	"Tus campos siguen ahí. Vuelve a intentarlo en un momento, antes de crear algo nuevo.";
export const RETRY = "Vuelve a intentarlo";

export const LABEL_LABEL = "Etiqueta";
export const KEY_LABEL = "Clave";
export const KEY_HELP =
	"Cómo lo llaman la API y tus agentes. Se genera desde la etiqueta y queda fija al guardar: cambiar la etiqueta después nunca rompe a quien lo use.";
export const AGENT_LABEL = "Deja que tus agentes lo rellenen";
export const AGENT_HELP =
	"Proponen un valor con su fuente y nunca sobrescriben el tuyo.";
export const BRIEF_LABEL = "Qué cuenta como respuesta";
export const BRIEF_HELP =
	"Si lo dejas vacío, tus agentes se guían solo por la etiqueta y el tipo.";
export const TYPE_LABEL = "Tipo";
export const OPTIONS_LABEL = "Opciones";
export const ADD_OPTION = "Agregar opción";
export const ALL_FILLED = "No queda nada por rellenar";

export function optionLabel(index: number): string {
	return `Opción ${index + 1}`;
}
export const ADD_FIELD = "Crear campo";
export const CANCEL = "Cancelar";
export const SAVE = "Guardar cambios";
export const ARCHIVE = "Archivar";
export const FILL_REST = "Rellenar el resto";

const SHEET_PLACEMENT = {
	COMPANY: "Mostrar en la ficha de la empresa",
	CONTACT: "Mostrar en la ficha del contacto",
	DEAL: "Mostrar en la ficha del negocio",
} satisfies Record<FieldEntity, string>;

const TABLE_PLACEMENT = {
	COMPANY: "Ofrecer como columna en la tabla de Empresas",
	CONTACT: "Ofrecer como columna en la tabla de Contactos",
	DEAL: "Ofrecer como columna en la tabla de Negocios",
} satisfies Record<FieldEntity, string>;

const FILTER_PLACEMENT = {
	COMPANY: "Ofrecer como filtro en la tabla de Empresas",
	CONTACT: "Ofrecer como filtro en la tabla de Contactos",
	DEAL: "Ofrecer como filtro en la tabla de Negocios",
} satisfies Record<FieldEntity, string>;

export function sheetPlacement(entity: FieldEntity): string {
	return SHEET_PLACEMENT[entity];
}

export function tablePlacement(entity: FieldEntity): string {
	return TABLE_PLACEMENT[entity];
}

export function filterPlacement(entity: FieldEntity): string {
	return FILTER_PLACEMENT[entity];
}

export const ENTITY_TABS = [
	{ kind: "company", label: "Empresas" },
	{ kind: "contact", label: "Contactos" },
	{ kind: "deal", label: "Negocios" },
] as const satisfies readonly { kind: RecordKind; label: string }[];
