import { Module } from "@nestjs/common";
import { AgentModule } from "../agent/agent.module";
import { IntakeController } from "./intake.controller";
import { IntakeService } from "./intake.service";

@Module({
	imports: [AgentModule],
	controllers: [IntakeController],
	providers: [IntakeService],
})
export class IntakeModule {}
