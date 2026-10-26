import { Module } from "@nestjs/common";
import { TrpcModule } from "../trpc/trpc.module";
import { WhatsappAssistantRouter } from "./whatsapp-assistant.router";
import { WhatsappAssistantService } from "./whatsapp-assistant.service";

@Module({
	imports: [TrpcModule],
	providers: [WhatsappAssistantService, WhatsappAssistantRouter],
})
export class WhatsappAssistantModule {}
