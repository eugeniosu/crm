import {
	canManageAssistant,
	WORKSPACE_ID,
	workspaceRoleOf,
} from "@crm/auth/organization";
import type { Db } from "@crm/db";
import {
	officeHoursProblem,
	readLeadsSettings,
	writeLeadsSettings,
} from "@crm/db/leads-settings";
import {
	BadRequestException,
	ForbiddenException,
	Injectable,
} from "@nestjs/common";
import { InjectDatabase } from "../database/database.constants";
import type {
	AssistantSettings,
	UpdateAssistantSettingsInput,
} from "./whatsapp-assistant.contracts";

@Injectable()
export class AssistantSettingsService {
	constructor(@InjectDatabase() private readonly db: Db) {}

	async settings(userId: string): Promise<AssistantSettings> {
		const [settings, members, role] = await Promise.all([
			readLeadsSettings(this.db),
			this.db.member.findMany({
				where: { organizationId: WORKSPACE_ID },
				orderBy: { createdAt: "asc" },
				select: { user: { select: { id: true, name: true, email: true } } },
			}),
			workspaceRoleOf(userId),
		]);
		return {
			...settings,
			owners: members.map((member) => member.user),
			canManage: canManageAssistant(role),
		};
	}

	async update(
		userId: string,
		input: UpdateAssistantSettingsInput,
	): Promise<AssistantSettings> {
		if (!canManageAssistant(await workspaceRoleOf(userId))) {
			throw new ForbiddenException(
				"Solo un propietario o un administrador puede cambiar el asistente de WhatsApp.",
			);
		}
		const problem = officeHoursProblem(input.hours);
		if (problem) throw new BadRequestException(problem);
		if (input.ownerId) {
			const member = await this.db.member.findUnique({
				where: {
					organizationId_userId: {
						organizationId: WORKSPACE_ID,
						userId: input.ownerId,
					},
				},
				select: { id: true },
			});
			if (!member) {
				throw new BadRequestException(
					"El responsable tiene que ser un miembro del espacio de trabajo.",
				);
			}
		}
		await writeLeadsSettings(this.db, input);
		return this.settings(userId);
	}
}
