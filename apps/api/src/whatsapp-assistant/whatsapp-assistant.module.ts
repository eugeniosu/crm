import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { WhatsappAssistantRouter } from "./whatsapp-assistant.router";
import { WhatsappAssistantService } from "./whatsapp-assistant.service";
import { WhatsappConnectionService } from "./whatsapp-connection.service";

@Module({
	imports: [TrpcModule],
	providers: [
		WhatsappAssistantService,
		WhatsappConnectionService,
		WhatsappAssistantRouter,
	],
})
export class WhatsappAssistantModule {}
