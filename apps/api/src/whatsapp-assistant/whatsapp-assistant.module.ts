import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { AssistantSettingsService } from "./assistant-settings.service";
import { WhatsappAssistantRouter } from "./whatsapp-assistant.router";
import { WhatsappAssistantService } from "./whatsapp-assistant.service";
import { WhatsappConnectionService } from "./whatsapp-connection.service";

@Module({
	imports: [TrpcModule],
	providers: [
		WhatsappAssistantService,
		AssistantSettingsService,
		WhatsappConnectionService,
		WhatsappAssistantRouter,
	],
})
export class WhatsappAssistantModule {}
