"use client";

import Add from "@carbon/icons-react/es/Add";
import Application from "@carbon/icons-react/es/Application";
import ArrowRight from "@carbon/icons-react/es/ArrowRight";
import Building from "@carbon/icons-react/es/Building";
import Checkmark from "@carbon/icons-react/es/Checkmark";
import Copy from "@carbon/icons-react/es/Copy";
import Partnership from "@carbon/icons-react/es/Partnership";
import Play from "@carbon/icons-react/es/Play";
import Renew from "@carbon/icons-react/es/Renew";
import Reply from "@carbon/icons-react/es/Reply";
import Security from "@carbon/icons-react/es/Security";
import ThumbsDown from "@carbon/icons-react/es/ThumbsDown";
import ThumbsUp from "@carbon/icons-react/es/ThumbsUp";
import User from "@carbon/icons-react/es/User";
import WarningAlt from "@carbon/icons-react/es/WarningAlt";
import {
	AsyncButtonContent,
	useAsyncAction,
} from "@crm/ui/components/async-action";
import { Badge } from "@crm/ui/components/badge";
import { Button } from "@crm/ui/components/button";
import { ChatMessage } from "@crm/ui/components/chat-message";
import { ChatThread, ChatThreadItem } from "@crm/ui/components/chat-thread";
import { DotMatrix } from "@crm/ui/components/dot-matrix";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuLabel,
	DropdownMenuRadioGroup,
	DropdownMenuRadioItem,
	DropdownMenuTrigger,
} from "@crm/ui/components/dropdown-menu";
import { Icon } from "@crm/ui/components/icon";
import { Markdown } from "@crm/ui/components/markdown";
import { ProviderMark } from "@crm/ui/components/provider-mark";
import { ThinkingIndicator } from "@crm/ui/components/thinking-indicator";
import { ToolStep } from "@crm/ui/components/tool-step";
import type { ProviderBrand } from "@crm/ui/lib/provider-brand";
import { cn } from "@crm/ui/lib/utils";
import type { AgentManifestSummary } from "@crm/validation/agent-manifest";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { MessageStreamEvent } from "eve/client";
import {
	type EveMessage,
	type EveMessageInputRequest,
	type UseEveAgentStatus,
	useEveAgent,
} from "eve/react";
import Link from "next/link";
import { Fragment, type ReactNode, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
	AgentClarificationComposer,
	type ClarificationResponse,
} from "@/components/agent-clarification-composer";
import { LocalDateTime } from "@/components/local-date-time";
import {
	consumeBuilderCommand,
	hasCreateAgentCommand,
} from "@/lib/agent-builder";
import {
	agentBuilderCallIsActive,
	builderConversationIsWorking,
	builderSessionStreamKey,
	builderStreamState,
	completedBuilderSteps,
	displayedArtifactVersionId,
	latestCompletedArtifactVersionId,
	mergeBuilderEventHistory,
	replacedFailedSubmissionIds,
	reviewVersionId,
} from "@/lib/agent-builder-state";
import { toolLabel } from "@/lib/agent-tool-display";
import {
	type AgentTurnFailure,
	conversationTimeline,
	eventStreamSettled,
	latestTurnFailure,
	messagesFromEvents,
	type PendingAgentConnection,
	pendingSupportedConnection,
	splitMarkdownTable,
	type TranscriptItem,
	toTranscript,
} from "@/lib/agent-transcript";
import { isSharedChatToken } from "@/lib/chat-route";
import { useTRPC } from "@/lib/trpc/client";
import type { RouterOutputs } from "@/lib/trpc/types";
import { useWorkspaceUrl } from "@/lib/use-workspace-url";
import { AgentCodeWorkspace } from "./agent-code-workspace";
import { AgentComposer, type BuilderPrompt } from "./agent-composer";
import {
	agentResultOwnsResponse,
	agentResultSkeleton,
	agentResultsByItem,
	hasAgentResult,
} from "./agent-result";
import { AgentScopeBadges } from "./agent-scope-badges";
import {
	ChatAttachmentChip,
	ChatCommandChip,
	ChatReferenceChip,
} from "./chat-chips";
import { DeleteChatAction } from "./delete-chat-action";
import { ShareChatDialog } from "./share-chat-dialog";

type Conversation = RouterOutputs["conversations"]["builderById"];
type SharedConversation = RouterOutputs["conversations"]["shared"];

export type SupportedChatConnection = {
	slug: string;
	name: string;
	description: string;
	brand: ProviderBrand | null;
};

const BUILDER_STEPS = [
	"Alcance",
	"Instrucciones",
	"Manifiesto",
	"Revisión",
] as const;
const BUILDER_STEP_ARTIFACTS = [
	null,
	"agent/instructions.md",
	"agent/manifest.json",
	"agent/README.md",
] as const;
const submissionResource = z.object({
	kind: z.enum(["integration", "company", "contact", "deal"]),
	id: z.string().min(1),
	label: z.string().min(1),
	detail: z.string().nullable().optional().catch(null),
	imageUrl: z.string().nullable().optional().catch(null),
});

const storedAttachment = z.object({
	id: z.string().min(1),
	name: z.string().min(1),
	type: z.string().min(1),
	size: z.number(),
	previewUrl: z.string().nullable().optional().catch(null),
});

const uploadAttachment = z.object({
	name: z.string().min(1),
	type: z.string().min(1),
	size: z.number(),
	contentBase64: z.string().min(1),
	previewUrl: z.string().nullable().optional().catch(null),
});

const builderMessage = z
	.object({
		text: z.string().nullable().catch(null),
		resources: z.array(submissionResource).catch([]),
		attachments: z
			.array(z.union([storedAttachment, uploadAttachment]))
			.catch([]),
		inputResponse: z
			.object({
				requestId: z.string().min(1),
				optionId: z.string().optional(),
			})
			.nullable()
			.catch(null),
	})
	.catch({
		text: null,
		resources: [],
		attachments: [],
		inputResponse: null,
	});

type BuilderMessage = z.infer<typeof builderMessage>;

const builderSubmissions = z.array(
	z.object({
		id: z.string(),
		createdAt: z.string(),
		clientRequestId: z.string().nullable().catch(null),
		commandType: z.enum(["CHAT", "CREATE_AGENT"]),
		message: builderMessage,
		status: z.string(),
		errorMessage: z.string().nullable().catch(null),
	}),
);

type BuilderSubmission = z.infer<typeof builderSubmissions>[number];

const streamEventShape = z.object({
	type: z.string().min(1),
	meta: z.object({ id: z.string().min(1), at: z.string().min(1) }),
});

const streamEvents = z
	.array(
		z
			.custom<MessageStreamEvent>(
				(value) => streamEventShape.safeParse(value).success,
			)
			.nullable()
			.catch(null),
	)
	.catch([])
	.transform((events) => events.filter((event) => event !== null));

type PendingSubmission = {
	clientRequestId: string;
	createdAt: string;
	commandType: "CHAT" | "CREATE_AGENT";
	message: BuilderMessage;
};

export function AgentBuilderChat({
	conversationId,
	initialData,
	supportedConnections,
}: {
	conversationId: string;
	initialData: Conversation | SharedConversation | null;
	supportedConnections: readonly SupportedChatConnection[];
}) {
	const trpc = useTRPC();
	const queryClient = useQueryClient();
	const sharedChat = isSharedChatToken(conversationId);
	const [liveStream, setLiveStream] = useState<{
		key: string;
		events: readonly MessageStreamEvent[];
	} | null>(null);
	const [sending, setSending] = useState<PendingSubmission[]>([]);
	const conversation = useQuery({
		...trpc.conversations.builderById.queryOptions({ id: conversationId }),
		enabled: !sharedChat,
		initialData: sharedChat ? undefined : (initialData as Conversation),
		refetchInterval: (query) => {
			const data = query.state.data;
			return data && builderConversationNeedsPolling(data) ? 2500 : false;
		},
	});
	const shared = useQuery({
		...trpc.conversations.shared.queryOptions({ token: conversationId }),
		enabled: sharedChat,
		initialData:
			sharedChat && initialData
				? (initialData as SharedConversation)
				: undefined,
		refetchInterval: (query) =>
			sharedConversationNeedsPolling(query.state.data) ? 5000 : false,
	});
	const events = useQuery({
		...trpc.conversations.events.queryOptions({
			id: conversationId,
			limit: 5000,
		}),
		enabled: !sharedChat && Boolean(conversation.data?.sessionId),
		initialData:
			!sharedChat && initialData
				? (initialData as Conversation).resume?.events
				: undefined,
		refetchInterval: (query) =>
			conversation.data &&
			(builderConversationNeedsPolling(conversation.data) ||
				!eventStreamSettled(query.state.data ?? []))
				? 2500
				: false,
	});
	const submit = useMutation(
		trpc.conversations.submitBuilder.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderById.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderList.pathKey(),
					}),
				]);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const answerQuestion = useMutation(
		trpc.conversations.answerBuilderQuestion.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderById.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderList.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.events.pathKey(),
					}),
				]);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const answerApproval = useMutation(
		trpc.conversations.answerBuilderApproval.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderById.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderList.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.events.pathKey(),
					}),
				]);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const answerSessionLimit = useMutation(
		trpc.conversations.answerBuilderSessionLimit.mutationOptions({
			onSuccess: async () => {
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderById.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.builderList.pathKey(),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.conversations.events.pathKey(),
					}),
				]);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const setPermissionMode = useMutation(
		trpc.conversations.setBuilderPermissionMode.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.conversations.builderById.pathKey(),
				}),
			onError: (error) => toast.error(error.message),
		}),
	);
	const markRead = useMutation(
		trpc.conversations.markRead.mutationOptions({
			onSuccess: () =>
				queryClient.invalidateQueries({
					queryKey: trpc.conversations.builderList.pathKey(),
				}),
		}),
	);

	if (sharedChat) {
		if (shared.isPending) {
			return (
				<main
					className="flex flex-1 items-center justify-center p-8"
					aria-busy="true"
				>
					<span className="text-muted-foreground text-sm">Abriendo chat…</span>
				</main>
			);
		}
		if (shared.isError || !shared.data) return <ChatUnavailable />;
		return (
			<SharedAgentChat
				conversation={shared.data}
				supportedConnections={supportedConnections}
			/>
		);
	}

	if (conversation.isError && !conversation.data) {
		return <ChatUnavailable />;
	}

	const data = conversation.data ?? (initialData as Conversation);
	const submissions = builderSubmissions.parse(data.submissions);
	const confirmedRequestIds = new Set(
		submissions
			.map((submission) => submission.clientRequestId)
			.filter((id): id is string => Boolean(id)),
	);
	const pendingSubmissions = sending.filter(
		(item) => !confirmedRequestIds.has(item.clientRequestId),
	);
	const savedPrefix = streamEvents.parse(data.resume?.events ?? []);
	const persistedEvents = mergeBuilderEventHistory(
		savedPrefix,
		streamEvents.parse(events.data ?? []),
	);
	const streamKey = builderSessionStreamKey(data.sessionId);
	const transcriptEvents =
		streamKey && liveStream?.key === streamKey
			? liveStream.events.reduce(appendEvent, persistedEvents)
			: persistedEvents;
	const agentMessages = messagesFromEvents(transcriptEvents);
	const replacedFailureIds = replacedFailedSubmissionIds(
		submissions.map((submission) => ({
			id: submission.id,
			status: submission.status,
			retryKey: retryKeyOf(submission),
		})),
	);
	const timeline = conversationTimeline(
		submissions.filter((submission) => !replacedFailureIds.has(submission.id)),
		transcriptEvents,
		agentMessages,
	);
	const answeredQuestionIds = questionResponseIds(submissions);
	const waitingQuestion = data.pendingQuestion;
	const question =
		waitingQuestion &&
		!hasQueuedInputResponse(submissions, waitingQuestion.requestId)
			? waitingQuestion
			: null;
	const waitingApproval = data.pendingApproval;
	const approval =
		waitingApproval &&
		!hasQueuedInputResponse(submissions, waitingApproval.requestId)
			? waitingApproval
			: null;
	const waitingSessionLimit = data.pendingSessionLimit;
	const sessionLimit =
		waitingSessionLimit &&
		!hasQueuedInputResponse(submissions, waitingSessionLimit.requestId)
			? waitingSessionLimit
			: null;
	const failure = latestTurnFailure(transcriptEvents);
	const creatingAgent = hasCreateAgentCommand(submissions);
	const working = builderConversationIsWorking(data) && !failure;
	const builderCallActive = agentBuilderCallIsActive(transcriptEvents);
	const currentSubmissionCreatesAgent =
		submissions.at(-1)?.commandType === "CREATE_AGENT";
	const reviewVersion = reviewVersionId(data);
	const artifactVersion = displayedArtifactVersionId(data, working);
	const latestRetryPrompt = retryPromptOf(submissions.at(-1));
	const connectionRequest = pendingSupportedConnection(
		transcriptEvents,
		supportedConnections,
		agentMessages,
	);
	const send = async (
		prompt: BuilderPrompt,
		clientRequestId = crypto.randomUUID(),
	) => {
		setSending((current) => [
			...current,
			{
				clientRequestId,
				createdAt: new Date().toISOString(),
				commandType: prompt.commandType ?? "CHAT",
				message: {
					text: prompt.message,
					resources: prompt.resources,
					attachments: prompt.attachments,
					inputResponse: null,
				},
			},
		]);

		try {
			await submit.mutateAsync({
				id: conversationId,
				clientRequestId,
				...prompt,
			});
		} finally {
			setSending((current) =>
				current.filter((item) => item.clientRequestId !== clientRequestId),
			);
		}
	};

	const renderChat = (streamControl: BuilderStreamControl) => {
		const streamState = builderStreamState(streamControl.status);
		const restoring = working && streamState.resuming;
		const streamBusy = working || streamState.cancellable;

		return (
			<main
				className="flex min-h-0 flex-1 flex-col"
				onPointerEnter={() => {
					if (
						data.lastAssistantAt &&
						(!data.lastReadAt ||
							new Date(data.lastAssistantAt) > new Date(data.lastReadAt)) &&
						!markRead.isPending
					) {
						markRead.mutate({ id: conversationId });
					}
				}}
			>
				<ChatHeader
					conversation={data}
					working={working}
					creatingAgent={creatingAgent}
				/>

				<ChatThread
					size="page"
					busy={streamBusy}
					composer={
						question ? (
							<AgentClarificationComposer
								key={question.requestId}
								question={question}
								pending={answerQuestion.isPending}
								onSubmit={async (response: ClarificationResponse) => {
									await answerQuestion.mutateAsync({
										id: conversationId,
										clientRequestId: crypto.randomUUID(),
										...response,
									});
								}}
							/>
						) : (
							<AgentComposer
								mode="chat"
								disabled={streamBusy}
								busy={streamState.cancellable}
								onStop={
									streamState.cancellable ? streamControl.cancel : undefined
								}
								permissionControl={
									<PermissionModeMenu
										mode={data.permissionMode}
										pending={setPermissionMode.isPending}
										onChange={(permissionMode) =>
											setPermissionMode.mutate({
												id: conversationId,
												permissionMode,
											})
										}
									/>
								}
								onSubmit={send}
							/>
						)
					}
				>
					{restoring ? (
						<ChatThreadItem id={`resuming:${conversationId}`}>
							<ChatMessage author="assistant">
								<div
									role="status"
									className="flex items-center gap-2 text-muted-foreground text-sm"
								>
									<ThinkingIndicator />
									<span>Restaurando este chat…</span>
								</div>
							</ChatMessage>
						</ChatThreadItem>
					) : null}
					{timeline.map((item) => {
						const prompt =
							item.kind === "submission"
								? retryPromptOf(item.submission)
								: null;
						return (
							<ChatThreadItem
								key={item.id}
								id={item.id}
								scrollAnchor={item.kind === "submission"}
							>
								{item.kind === "submission" ? (
									<UserSubmission
										submission={item.submission}
										failed={item.submission.status === "FAILED"}
										retrying={submit.isPending}
										onRetry={prompt ? () => send(prompt) : null}
									/>
								) : (
									<AssistantMessage
										conversation={data}
										message={item.message}
										answeredQuestionIds={answeredQuestionIds}
										supportedConnections={supportedConnections}
									/>
								)}
							</ChatThreadItem>
						);
					})}
					{approval ? (
						<ChatThreadItem id={`approval:${approval.requestId}`} scrollAnchor>
							<AgentApprovalCard
								approval={approval}
								pending={answerApproval.isPending}
								onDecision={(decision) =>
									answerApproval.mutate({
										id: conversationId,
										clientRequestId: crypto.randomUUID(),
										requestId: approval.requestId,
										decision,
									})
								}
							/>
						</ChatThreadItem>
					) : null}
					{sessionLimit ? (
						<ChatThreadItem
							id={`session-limit:${sessionLimit.requestId}`}
							scrollAnchor
						>
							<AgentSessionLimitCard
								request={sessionLimit}
								pending={answerSessionLimit.isPending}
								onDecision={(decision) =>
									answerSessionLimit.mutate({
										id: conversationId,
										clientRequestId: crypto.randomUUID(),
										requestId: sessionLimit.requestId,
										decision,
									})
								}
							/>
						</ChatThreadItem>
					) : null}

					{pendingSubmissions.map((item) => (
						<ChatThreadItem
							key={item.clientRequestId}
							id={`sending:${item.clientRequestId}`}
							scrollAnchor
						>
							<UserSubmission
								submission={{
									id: item.clientRequestId,
									createdAt: item.createdAt,
									clientRequestId: item.clientRequestId,
									commandType: item.commandType,
									message: item.message,
									status: "PENDING",
									errorMessage: null,
								}}
								failed={false}
								retrying={false}
								onRetry={null}
								sending
							/>
						</ChatThreadItem>
					))}

					{connectionRequest ? (
						<ChatThreadItem
							id={`connection:${connectionRequest.slug}`}
							scrollAnchor
						>
							<AgentConnectionCard
								connection={connectionRequest}
								onContinue={() =>
									send({
										commandType: "CHAT",
										message: "Continúa con mi solicitud.",
										resources: [],
										attachments: [],
									})
								}
							/>
						</ChatThreadItem>
					) : null}

					{pendingSubmissions.length > 0 || (working && !builderCallActive) ? (
						<ChatThreadItem id={`thinking:${conversationId}`}>
							<ChatMessage author="assistant">
								<ThinkingIndicator />
							</ChatMessage>
						</ChatThreadItem>
					) : null}

					{working && builderCallActive ? (
						<ChatThreadItem id={`building-agent:${conversationId}`}>
							<BuildingAgentCard
								sessionId={data.sessionId}
								artifacts={data.builderArtifacts}
								startedAt={submissions.at(-1)?.createdAt ?? null}
							/>
						</ChatThreadItem>
					) : null}

					{creatingAgent && data.builderArtifacts.length > 0 ? (
						<ChatThreadItem id={`agent-workspace:${conversationId}`}>
							<AgentCodeWorkspace
								artifacts={data.builderArtifacts}
								working={working}
								versionId={artifactVersion}
							/>
						</ChatThreadItem>
					) : null}

					{!working && failure ? (
						<ChatThreadItem id={`builder-failure:${conversationId}`}>
							<BuilderFailureCard
								failure={failure}
								creatingAgent={currentSubmissionCreatesAgent}
								retrying={submit.isPending}
								onRetry={
									latestRetryPrompt ? () => send(latestRetryPrompt) : null
								}
							/>
						</ChatThreadItem>
					) : null}

					{creatingAgent && !working && reviewVersion ? (
						<ChatThreadItem id={`review-agent:${conversationId}`}>
							<ReviewAgentCard conversation={data} versionId={reviewVersion} />
						</ChatThreadItem>
					) : null}

					{creatingAgent && data.agent?.status === "LIVE" && !reviewVersion ? (
						<ChatThreadItem id={`deployed-agent:${conversationId}`}>
							<DeployedAgentCard
								conversation={data}
								onFollowUp={(message) =>
									send({
										commandType: "CREATE_AGENT",
										message,
										resources: [],
										attachments: [],
									})
								}
							/>
						</ChatThreadItem>
					) : null}
				</ChatThread>
			</main>
		);
	};

	if (streamKey && data.sessionId) {
		return (
			<BuilderEventFollower
				key={streamKey}
				conversationId={conversationId}
				resume={data.resume}
				sessionId={data.sessionId}
				onEvent={(event) =>
					setLiveStream((current) => ({
						key: streamKey,
						events:
							current?.key === streamKey
								? appendEvent(current.events, event)
								: [event],
					}))
				}
				onEnded={() =>
					setLiveStream((current) =>
						current?.key === streamKey ? null : current,
					)
				}
			>
				{renderChat}
			</BuilderEventFollower>
		);
	}

	return renderChat({ status: "ready", cancel: async () => undefined });
}

type BuilderStreamControl = {
	status: UseEveAgentStatus;
	cancel: () => Promise<unknown>;
};

function BuilderEventFollower({
	conversationId,
	sessionId,
	resume,
	onEvent,
	onEnded,
	children,
}: {
	conversationId: string;
	sessionId: string;
	resume: Conversation["resume"];
	onEvent: (event: MessageStreamEvent) => void;
	onEnded: () => void;
	children: (control: BuilderStreamControl) => ReactNode;
}) {
	const agent = useEveAgent({
		headers: { "x-crm-builder-conversation": conversationId },
		initialEvents: streamEvents.parse(resume?.events ?? []),
		initialSession: resume?.session ?? { sessionId, streamIndex: 0 },
		resume: true,
		onEvent,
		onError: onEnded,
	});

	return children({ status: agent.status, cancel: agent.cancel });
}

function withoutTable(text: string): string {
	const { after, found } = splitMarkdownTable(text);
	return found ? after : text;
}

function displayMarkdown(text: string): string {
	return text.replace(/\s*—\s*/g, ", ");
}

function AgentToolStep({
	item,
}: {
	item: Extract<TranscriptItem, { kind: "did" }>;
}) {
	if (
		(item.tool === "request_connection" && !item.pending) ||
		/^[a-z][a-z0-9-]{0,63}__/.test(item.tool)
	) {
		return null;
	}

	return (
		<div className="flex min-w-0 flex-col gap-2">
			<ToolStep
				label={toolLabel(item)}
				state={
					item.pending ? "pending" : item.tone === "warning" ? "failed" : "done"
				}
				error={item.errorText}
			/>
			{hasAgentResult(item.tool) && item.pending
				? agentResultSkeleton(item.tool)
				: null}
		</div>
	);
}

function appendEvent(
	events: readonly MessageStreamEvent[],
	event: MessageStreamEvent,
): readonly MessageStreamEvent[] {
	return events.some((candidate) => candidate.meta.id === event.meta.id)
		? events
		: [...events, event];
}

function SharedAgentChat({
	conversation,
	supportedConnections,
}: {
	conversation: SharedConversation;
	supportedConnections: readonly SupportedChatConnection[];
}) {
	const submissions = builderSubmissions.parse(conversation.submissions);
	const events = streamEvents.parse(conversation.events);
	const messages = messagesFromEvents(events);
	const timeline = conversationTimeline(submissions, events, messages);
	const answeredQuestionIds = questionResponseIds(submissions);
	const working = events.length > 0 && !eventStreamSettled(events);
	const artifactVersion = working
		? null
		: latestCompletedArtifactVersionId(conversation.builderArtifacts);

	return (
		<main className="flex min-h-0 flex-1 flex-col">
			<header className="flex h-12 shrink-0 items-center gap-3 border-b px-5">
				<h1 className="min-w-0 flex-1 truncate font-medium text-sm">
					{conversation.agent?.name ??
						conversation.title ??
						"Creador de agentes"}
				</h1>
				<span className="text-muted-foreground text-xs">Solo lectura</span>
			</header>

			<ChatThread size="page" busy={working}>
				<ChatThreadItem id="shared-chat-notice">
					<div className="rounded-lg border bg-card px-4 py-3 text-sm">
						<p className="font-medium">
							Compartido por {conversation.ownerName}
						</p>
						<p className="mt-1 text-muted-foreground text-xs">
							Puedes leer este chat del creador, pero solo su dueño puede
							continuarlo o cambiarlo.
						</p>
					</div>
				</ChatThreadItem>

				{timeline.map((item) => (
					<ChatThreadItem
						key={item.id}
						id={item.id}
						scrollAnchor={item.kind === "submission"}
					>
						{item.kind === "submission" ? (
							<UserSubmission
								submission={item.submission}
								failed={item.submission.status === "FAILED"}
								retrying={false}
								onRetry={null}
							/>
						) : (
							<AssistantMessage
								conversation={null}
								message={item.message}
								answeredQuestionIds={answeredQuestionIds}
								supportedConnections={supportedConnections}
							/>
						)}
					</ChatThreadItem>
				))}

				{conversation.builderArtifacts.length > 0 ? (
					<ChatThreadItem id={`agent-workspace:${conversation.id}`}>
						<AgentCodeWorkspace
							artifacts={conversation.builderArtifacts}
							working={working}
							versionId={artifactVersion}
						/>
					</ChatThreadItem>
				) : null}
			</ChatThread>
		</main>
	);
}

function ChatHeader({
	conversation,
	working,
	creatingAgent,
}: {
	conversation: Conversation;
	working: boolean;
	creatingAgent: boolean;
}) {
	const workspaceUrl = useWorkspaceUrl();
	const title =
		(creatingAgent ? conversation.agent?.name : null) ??
		conversation.title ??
		"Chat del agente";

	return (
		<header className="flex h-12 shrink-0 items-center gap-2 border-b px-4 sm:gap-2.5 sm:pr-4 sm:pl-5">
			<div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
				<h1 className="truncate font-medium text-sm">{title}</h1>
				<span className="hidden shrink-0 text-muted-foreground text-xs sm:inline">
					Privado
				</span>
				{working ? (
					<span className="flex shrink-0 items-center gap-2 text-muted-foreground text-xs">
						<Icon
							icon={Renew}
							className="size-3.5 animate-spin text-ring"
							motion="none"
						/>
						<span className="sr-only">Trabajando en segundo plano</span>
						<span aria-hidden="true" className="hidden sm:inline">
							Trabajando en segundo plano
						</span>
					</span>
				) : null}
			</div>
			<Button asChild variant="ghost" size="icon-sm">
				<Link href={workspaceUrl("/chat")} aria-label="Empezar un chat nuevo">
					<Icon icon={Add} />
				</Link>
			</Button>
			<ShareChatDialog conversationId={conversation.id} title={title} />
			<DeleteChatAction
				conversationId={conversation.id}
				title={title}
				trigger="menu"
				returnToChatList
			/>
		</header>
	);
}

function UserSubmission({
	submission,
	failed,
	retrying,
	onRetry,
	sending = false,
}: {
	submission: BuilderSubmission;
	failed: boolean;
	retrying: boolean;
	onRetry: (() => void) | null;
	sending?: boolean;
}) {
	const message = submission.message;
	const messageText = message.text ?? "Mensaje no disponible";
	const command =
		submission.commandType === "CREATE_AGENT"
			? consumeBuilderCommand(messageText)
			: null;
	const text = command?.body ?? messageText;
	const response = message.inputResponse;

	return (
		<ChatMessage
			author="user"
			sending={sending}
			error={
				failed ? (
					<div className="flex items-center justify-end gap-2">
						<span>No se pudo enviar este mensaje.</span>
						{onRetry ? (
							<Button
								variant="outline"
								size="xs"
								disabled={retrying}
								aria-busy={retrying}
								onClick={onRetry}
							>
								{retrying ? "Enviando" : "Enviar de nuevo"}
							</Button>
						) : null}
					</div>
				) : null
			}
		>
			<div
				className={cn(
					"flex min-w-0 flex-col gap-2",
					response && "gap-1.5 border-ring border-r-2 pr-2",
				)}
			>
				{response ? (
					<div className="flex items-center gap-1.5 text-muted-foreground text-xs">
						<Icon icon={Reply} className="size-3.5" />
						<span>Respuesta a la consulta</span>
					</div>
				) : null}
				{submission.commandType === "CREATE_AGENT" ? (
					<div className="flex flex-wrap gap-1">
						<ChatCommandChip label="Crear agente" icon={Application} />
					</div>
				) : null}
				<p className="wrap-break-word">{text}</p>
				{message.resources.length > 0 || message.attachments.length > 0 ? (
					<div className="flex flex-wrap gap-1 pt-1">
						{message.resources.map((resource) => (
							<ChatReferenceChip
								key={`${resource.kind}:${resource.id}`}
								resource={resource}
								icon={RESOURCE_ICONS[resource.kind]}
							/>
						))}
						{message.attachments.map((attachment) => (
							<ChatAttachmentChip
								key={`${attachment.name}:${attachment.size}`}
								attachment={attachment}
							/>
						))}
					</div>
				) : null}
			</div>
		</ChatMessage>
	);
}

function AssistantMessage({
	conversation,
	message,
	answeredQuestionIds,
	supportedConnections,
}: {
	conversation: Conversation | null;
	message: EveMessage;
	answeredQuestionIds: ReadonlySet<string>;
	supportedConnections: readonly SupportedChatConnection[];
}) {
	const [transcript] = toTranscript([message]);
	if (!transcript || transcript.mine) return null;

	const textParts: string[] = [];
	for (const item of transcript.items) {
		if (item.kind === "said") textParts.push(item.text);
	}
	const markdown = textParts.join("\n\n");
	const results = agentResultsByItem(transcript.items, supportedConnections);
	const resultOwnsResponse =
		results.size > 0 &&
		transcript.items.some(
			(item) =>
				item.kind === "did" &&
				agentResultOwnsResponse(item.tool, supportedConnections),
		);

	return (
		<ChatMessage author="assistant">
			{transcript.items.map((item) => {
				if (item.kind === "reasoned") {
					if (!item.streaming) return null;

					return (
						<div
							key={item.id}
							role="status"
							className="flex items-center gap-2 text-muted-foreground text-sm"
						>
							<ThinkingIndicator />
							<span>Pensando…</span>
						</div>
					);
				}

				if (item.kind === "did") {
					return (
						<Fragment key={item.id}>
							<AgentToolStep item={item} />
							{results.get(item.id)}
						</Fragment>
					);
				}

				if (item.kind === "said") {
					if (resultOwnsResponse) return null;
					const text = displayMarkdown(
						results.size > 0 ? withoutTable(item.text) : item.text,
					);
					if (!text) return null;

					return (
						<Markdown
							key={item.id}
							className="wrap-break-word text-sm leading-5"
						>
							{text}
						</Markdown>
					);
				}

				return conversation === null ||
					answeredQuestionIds.has(item.question.requestId) ? (
					<FollowUpTranscriptItem
						key={item.id}
						question={item.question}
						answered={answeredQuestionIds.has(item.question.requestId)}
					/>
				) : null;
			})}
			{markdown && !resultOwnsResponse ? (
				conversation ? (
					<ResponseActions
						conversation={conversation}
						messageId={transcript.id}
						markdown={markdown}
					/>
				) : (
					<CopyResponseAction markdown={markdown} />
				)
			) : null}
		</ChatMessage>
	);
}

function FollowUpTranscriptItem({
	question,
	answered,
}: {
	question: EveMessageInputRequest;
	answered: boolean;
}) {
	return (
		<div className="w-full max-w-sm border-ring/50 border-l-2 bg-muted/40 px-3 py-2.5">
			<div className="flex items-center justify-between gap-3 text-xs">
				<span className="font-medium">Consulta</span>
				<span className="text-muted-foreground">
					{answered ? "Respondida" : "Esperando tu respuesta"}
				</span>
			</div>
			<Markdown className="mt-1.5 wrap-break-word text-sm leading-5">
				{question.prompt}
			</Markdown>
		</div>
	);
}

type PermissionMode = Conversation["permissionMode"];
type ToolApproval = NonNullable<Conversation["pendingApproval"]>;
type SessionLimit = NonNullable<Conversation["pendingSessionLimit"]>;

const PERMISSION_MODES: ReadonlyArray<{
	value: PermissionMode;
	label: string;
	description: string;
}> = [
	{
		value: "manual",
		label: "Manual",
		description: "Pregunta antes de cada cambio.",
	},
	{
		value: "auto",
		label: "Automático",
		description: "Pregunta solo antes de cambios sensibles.",
	},
	{
		value: "bypass",
		label: "Sin aprobación",
		description: "Aplica los cambios sin preguntar.",
	},
];

function PermissionModeMenu({
	mode,
	pending,
	onChange,
}: {
	mode: PermissionMode;
	pending: boolean;
	onChange: (mode: PermissionMode) => void;
}) {
	const selected = PERMISSION_MODES.find((entry) => entry.value === mode);

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="ghost"
					size="sm"
					disabled={pending}
					aria-label={`Modo de permisos: ${selected?.label ?? "Manual"}`}
				>
					<Icon icon={Security} data-icon="inline-start" />
					{selected?.label ?? "Manual"}
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="w-64">
				<DropdownMenuLabel>Modo de permisos</DropdownMenuLabel>
				<DropdownMenuRadioGroup
					value={mode}
					onValueChange={(value) => {
						const next = PERMISSION_MODES.find(
							(entry) => entry.value === value,
						);
						if (next) onChange(next.value);
					}}
				>
					{PERMISSION_MODES.map((entry) => (
						<DropdownMenuRadioItem key={entry.value} value={entry.value}>
							<span className="flex flex-col gap-0.5">
								<span className="font-medium">{entry.label}</span>
								<span className="text-muted-foreground">
									{entry.description}
								</span>
							</span>
						</DropdownMenuRadioItem>
					))}
				</DropdownMenuRadioGroup>
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function AgentApprovalCard({
	approval,
	pending,
	onDecision,
}: {
	approval: ToolApproval;
	pending: boolean;
	onDecision: (decision: "approve" | "cancel") => void;
}) {
	const label = toolLabel({
		tool: approval.action.toolName,
		input: approval.action.input,
		label: "Solicitó un cambio",
		pending: true,
	});

	return (
		<fieldset
			disabled={pending}
			className="w-full max-w-lg overflow-hidden rounded-lg border bg-card"
		>
			<legend className="sr-only">Se requiere aprobación</legend>
			<div className="flex items-start gap-3 p-4">
				<div className="min-w-0 flex-1">
					<p className="font-medium text-sm">Se requiere aprobación</p>
					<p className="mt-1 text-muted-foreground text-xs">{label}</p>
					<p className="mt-2 text-pretty text-sm leading-5">
						{approval.prompt}
					</p>
				</div>
			</div>
			<div className="flex items-center justify-end gap-2 border-t bg-muted px-4 py-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onDecision("cancel")}
				>
					Rechazar
				</Button>
				<Button type="button" size="sm" onClick={() => onDecision("approve")}>
					{pending ? "Aprobando" : "Aprobar"}
				</Button>
			</div>
		</fieldset>
	);
}

function AgentSessionLimitCard({
	request,
	pending,
	onDecision,
}: {
	request: SessionLimit;
	pending: boolean;
	onDecision: (decision: "continue" | "stop") => void;
}) {
	return (
		<fieldset
			disabled={pending}
			className="w-full max-w-lg overflow-hidden rounded-lg border bg-card"
		>
			<legend className="sr-only">Se alcanzó el límite de la sesión</legend>
			<div className="p-4">
				<p className="font-medium text-sm">Se alcanzó el límite de la sesión</p>
				<p className="mt-2 text-pretty text-sm leading-5">{request.prompt}</p>
			</div>
			<div className="flex items-center justify-end gap-2 border-t bg-muted px-4 py-3">
				<Button
					type="button"
					variant="outline"
					size="sm"
					onClick={() => onDecision("stop")}
				>
					Detener
				</Button>
				<Button type="button" size="sm" onClick={() => onDecision("continue")}>
					{pending ? "Continuando" : "Continuar"}
				</Button>
			</div>
		</fieldset>
	);
}

function CopyResponseAction({ markdown }: { markdown: string }) {
	return (
		<div className="flex h-7 items-center">
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label="Copiar respuesta como Markdown"
				onClick={() => {
					void navigator.clipboard.writeText(markdown);
					toast.success("Respuesta copiada como Markdown.");
				}}
			>
				<Icon icon={Copy} />
			</Button>
		</div>
	);
}

function ResponseActions({
	conversation,
	messageId,
	markdown,
}: {
	conversation: Conversation;
	messageId: string;
	markdown: string;
}) {
	const trpc = useTRPC();
	const initial = conversation.feedback.find(
		(item) => item.messageId === messageId,
	)?.rating;
	const [rating, setRating] = useState<"UP" | "DOWN" | null>(initial ?? null);
	const rate = useMutation(
		trpc.conversations.rateBuilderResponse.mutationOptions({
			onError: (error) => toast.error(error.message),
		}),
	);

	const choose = (next: "UP" | "DOWN") => {
		const value = rating === next ? null : next;
		setRating(value);
		rate.mutate({ id: conversation.id, messageId, rating: value });
	};

	return (
		<div className="flex h-7 items-center gap-0.5">
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label="Copiar respuesta como Markdown"
				onClick={() => {
					void navigator.clipboard.writeText(markdown);
					toast.success("Respuesta copiada como Markdown.");
				}}
			>
				<Icon icon={Copy} />
			</Button>
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label="Valorar respuesta como útil"
				aria-pressed={rating === "UP"}
				className={cn(rating === "UP" && "bg-muted text-foreground")}
				onClick={() => choose("UP")}
			>
				<Icon icon={ThumbsUp} />
			</Button>
			<Button
				variant="ghost"
				size="icon-xs"
				aria-label="Valorar respuesta como no útil"
				aria-pressed={rating === "DOWN"}
				className={cn(rating === "DOWN" && "bg-muted text-foreground")}
				onClick={() => choose("DOWN")}
			>
				<Icon icon={ThumbsDown} />
			</Button>
		</div>
	);
}

function BuildingAgentCard({
	sessionId,
	artifacts,
	startedAt,
}: {
	sessionId: string | null;
	artifacts: Conversation["builderArtifacts"];
	startedAt: string | null;
}) {
	const completed = completedBuilderSteps(artifacts, startedAt, sessionId);

	const writingPath =
		artifacts.find((artifact) => artifact.status === "WRITING")?.path ?? null;

	return (
		<div className="w-full max-w-lg">
			<div className="overflow-hidden rounded-lg border bg-card">
				<div className="flex items-center gap-2 px-4 pt-4">
					<span className="min-w-0 flex-1 font-medium text-sm">
						Creando el agente
					</span>
					<span className="shrink-0 font-mono text-muted-foreground text-xs">
						{completed} de 4
					</span>
				</div>
				<ol
					className="flex flex-col gap-1 p-3"
					aria-label="Creación del agente"
				>
					{BUILDER_STEPS.map((label, index) => {
						const done = index < completed;
						const active =
							index === completed && completed < BUILDER_STEPS.length;
						const artifact = BUILDER_STEP_ARTIFACTS[index];

						return (
							<li
								key={label}
								className={cn(
									"flex min-h-8 min-w-0 flex-col justify-center gap-1 rounded-md px-2",
									active && "bg-muted py-2",
								)}
								aria-current={active ? "step" : undefined}
							>
								<div className="flex min-w-0 items-center gap-2">
									<span
										className={cn(
											"flex size-5 shrink-0 items-center justify-center font-mono text-xs",
											(done || active) && "text-ring",
											!done && !active && "text-muted-foreground",
										)}
									>
										{done ? (
											<Icon icon={Checkmark} className="size-3.5" />
										) : active ? (
											<DotMatrix decorative />
										) : (
											index + 1
										)}
									</span>
									<span
										className={cn(
											"min-w-0 flex-1 wrap-break-word text-sm",
											!done && !active && "text-muted-foreground",
										)}
									>
										{label}
									</span>
									<span
										className={cn(
											"shrink-0 text-xs",
											done && artifact && "font-mono",
											active ? "text-foreground" : "text-muted-foreground",
										)}
									>
										{done && artifact
											? artifact.replace("agent/", "")
											: done
												? "Listo"
												: active
													? "En curso"
													: "En espera"}
									</span>
								</div>
								{active && writingPath ? (
									<p className="pl-7 font-mono text-muted-foreground text-xs">
										Escribiendo {writingPath}
									</p>
								) : null}
							</li>
						);
					})}
				</ol>
				<footer className="flex items-center gap-2 border-t bg-muted px-4 py-3">
					<p className="min-w-0 flex-1 text-pretty text-muted-foreground text-xs">
						Se ejecuta en segundo plano
					</p>
				</footer>
			</div>
		</div>
	);
}

function AgentConnectionCard({
	connection,
	onContinue,
}: {
	connection: PendingAgentConnection;
	onContinue: () => Promise<void>;
}) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const [accessMode, setAccessMode] = useState<"read_only" | "read_write">(
		"read_write",
	);
	const connections = useQuery({
		...trpc.mcp.list.queryOptions(),
		refetchInterval: (query) => {
			const entry = query.state.data?.entries.find(
				(item) => item.slug === connection.slug,
			);
			return entry?.connection?.status === "connecting" ? 1500 : false;
		},
	});
	const start = useMutation(
		trpc.mcp.start.mutationOptions({
			onSuccess: ({ authorizationUrl }) => {
				window.location.assign(authorizationUrl);
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const entry = connections.data?.entries.find(
		(item) => item.slug === connection.slug,
	);
	const status = entry?.connection?.status ?? connection.status;
	const connected = status === "connected";
	const connecting = status === "connecting";
	const canConnect = Boolean(
		connections.data?.configured && connections.data.canManage,
	);

	function connect() {
		start.mutate({
			platformSlug: connection.slug,
			accessMode,
			returnPath: window.location.pathname,
		});
	}

	return (
		<ChatMessage author="assistant">
			<div className="w-full max-w-lg overflow-hidden rounded-lg border bg-card">
				<div className="flex items-start gap-3 px-4 py-3">
					<ProviderMark
						slug={connection.slug}
						name={connection.name}
						brand={connection.brand}
						className="mt-0.5 size-5"
					/>
					<div className="flex min-w-0 flex-1 flex-col gap-1">
						<p className="font-medium text-sm">
							{connected
								? `${connection.name} está lista`
								: `Conectar ${connection.name}`}
						</p>
						<p className="text-pretty text-muted-foreground text-sm">
							{connected
								? "Continúa la solicitud con esta conexión."
								: connecting
									? "Leyendo las herramientas disponibles."
									: connection.description}
						</p>
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-3 border-t bg-muted px-4 py-3">
					{connected ? (
						<p className="text-muted-foreground text-xs">Conectado</p>
					) : canConnect ? (
						<div className="flex items-center gap-1">
							<Button
								variant={accessMode === "read_only" ? "secondary" : "ghost"}
								size="xs"
								aria-pressed={accessMode === "read_only"}
								onClick={() => setAccessMode("read_only")}
							>
								Solo lectura
							</Button>
							<Button
								variant={accessMode === "read_write" ? "secondary" : "ghost"}
								size="xs"
								aria-pressed={accessMode === "read_write"}
								onClick={() => setAccessMode("read_write")}
							>
								Lectura y escritura
							</Button>
						</div>
					) : (
						<p className="text-muted-foreground text-xs">
							El acceso a la conexión requiere un administrador.
						</p>
					)}
					{connected ? (
						<Button size="sm" onClick={() => void onContinue()}>
							Continuar
						</Button>
					) : canConnect ? (
						<Button
							size="sm"
							disabled={connecting || start.isPending}
							aria-busy={connecting || start.isPending}
							onClick={connect}
						>
							{connecting || start.isPending ? "Conectando" : "Conectar"}
						</Button>
					) : (
						<Button asChild size="sm" variant="outline">
							<Link
								href={workspaceUrl(`/settings/connections/${connection.slug}`)}
							>
								Abrir configuración
							</Link>
						</Button>
					)}
				</div>
			</div>
		</ChatMessage>
	);
}

function BuilderFailureCard({
	failure,
	creatingAgent,
	retrying,
	onRetry,
}: {
	failure: AgentTurnFailure;
	creatingAgent: boolean;
	retrying: boolean;
	onRetry: (() => void) | null;
}) {
	const message =
		failure.kind === "cancelled"
			? "Detuviste esta solicitud. Vuelve a pedirlo cuando quieras."
			: failure.kind === "rate-limit"
				? "Vercel AI Gateway limitó el uso de este modelo antes de que pudiera empezar. Vuelve a intentarlo en un momento o agrega créditos de AI Gateway en Vercel."
				: failure.kind === "restricted"
					? "Este modelo requiere créditos de pago de AI Gateway. Agrega créditos en Vercel y vuelve a intentarlo."
					: failure.kind === "credits"
						? "Vercel AI Gateway no tiene créditos disponibles. Agrega créditos en Vercel y vuelve a intentarlo."
						: "El creador no pudo terminar esta solicitud. Vuelve a intentarlo.";

	return (
		<div
			role="alert"
			className="flex flex-col items-stretch gap-3 rounded-lg border border-destructive/30 bg-card px-4 py-3 sm:flex-row sm:items-start"
		>
			<div className="flex min-w-0 flex-1 items-start gap-3">
				<Icon icon={WarningAlt} className="mt-0.5 size-4 text-destructive" />
				<div className="min-w-0 flex-1">
					<p className="font-medium text-sm">
						{creatingAgent
							? "Se detuvo la creación del agente"
							: "Se detuvo la respuesta"}
					</p>
					<p className="mt-0.5 text-pretty text-muted-foreground text-xs leading-5">
						{message}
					</p>
				</div>
			</div>
			{onRetry ? (
				<Button
					variant="outline"
					size="sm"
					disabled={retrying}
					aria-busy={retrying}
					onClick={onRetry}
				>
					<AsyncButtonContent
						status={retrying ? "pending" : "idle"}
						pendingLabel="Pidiendo"
					>
						Pedir de nuevo
					</AsyncButtonContent>
				</Button>
			) : null}
		</div>
	);
}

function ReviewAgentCard({
	conversation,
	versionId,
}: {
	conversation: Conversation;
	versionId: string;
}) {
	const workspaceUrl = useWorkspaceUrl();
	const version = conversation.createdVersions.find(
		(candidate) => candidate.id === versionId,
	);
	const agent = conversation.agent;

	if (!version || !agent) return null;
	const manifest = manifestOf(version.manifest);

	return (
		<div className="flex flex-col gap-5">
			<p className="max-w-[640px] text-pretty text-sm leading-5">
				Tu borrador privado está listo para revisar.
			</p>
			<AgentCardShell name={manifest.name ?? agent.name} status="Privado">
				<div className="flex flex-col gap-2 p-4">
					<ReviewRow label="Cuándo" value={manifest.trigger} />
					<ReviewRow label="Busca" value={manifest.looksAt} />
					<ReviewRow label="Luego" value={manifest.action} />
					<ReviewRow label="Alcance">
						<AgentScopeBadges
							scopes={manifest.access}
							fallback="Acceso de lectura acotado al CRM"
						/>
					</ReviewRow>
				</div>
				<AgentCardFooter note="En entorno aislado · las credenciales nunca entran al entorno aislado">
					<Button asChild size="sm">
						<Link
							href={workspaceUrl(`/agents/${agent.id}`)}
							transitionTypes={["nav-forward"]}
						>
							Ver detalles
							<Icon icon={ArrowRight} data-icon="inline-end" />
						</Link>
					</Button>
				</AgentCardFooter>
			</AgentCardShell>
		</div>
	);
}

function AgentCardShell({
	name,
	status,
	children,
}: {
	name: string;
	status: string;
	children: ReactNode;
}) {
	return (
		<div className="flex w-full max-w-lg flex-col overflow-hidden rounded-lg border bg-card">
			<div className="flex items-center gap-2 px-4 pt-4">
				<h2 className="min-w-0 flex-1 wrap-break-word font-medium text-sm">
					{name}
				</h2>
				<Badge variant="token">{status}</Badge>
			</div>
			{children}
		</div>
	);
}

function AgentCardFooter({
	note,
	children,
}: {
	note: string;
	children: ReactNode;
}) {
	return (
		<div className="flex flex-col items-stretch gap-3 border-t bg-muted px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
			<p className="text-pretty text-muted-foreground text-xs">{note}</p>
			<div className="sm:shrink-0">{children}</div>
		</div>
	);
}

function ReviewRow({
	label,
	value,
	children,
}: {
	label: string;
	value?: ReactNode;
	children?: ReactNode;
}) {
	return (
		<div className="flex flex-col gap-0.5 sm:flex-row sm:items-start sm:gap-4">
			<span className="text-muted-foreground text-sm leading-5 sm:w-16 sm:shrink-0">
				{label}
			</span>
			<div className="min-w-0 flex-1 wrap-break-word font-medium text-sm leading-5">
				{children ?? value}
			</div>
		</div>
	);
}

function DeployedAgentCard({
	conversation,
	onFollowUp,
}: {
	conversation: Conversation;
	onFollowUp: (message: string) => Promise<void>;
}) {
	const trpc = useTRPC();
	const workspaceUrl = useWorkspaceUrl();
	const queryClient = useQueryClient();
	const agent = conversation.agent;
	const run = useMutation(
		trpc.agents.runNow.mutationOptions({
			onSuccess: async () => {
				await queryClient.invalidateQueries({
					queryKey: trpc.agents.history.pathKey(),
				});
				toast.success("Ejecución del agente en cola.");
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const runAction = useAsyncAction({
		action: () =>
			run.mutateAsync({
				id: agent?.id ?? "",
				clientRequestId: crypto.randomUUID(),
			}),
	});

	if (!agent) return null;
	const enabledTriggers = agent.triggers.filter((trigger) => trigger.enabled);
	const nextRun =
		enabledTriggers.length === 1 ? enabledTriggers[0]?.nextRunAt : null;
	const triggerSummary =
		enabledTriggers.map((trigger) => trigger.name).join(" · ") || "Solo manual";

	return (
		<div className="flex flex-col gap-[18px]">
			<div className="flex flex-col gap-1">
				<p className="text-sm leading-5">{agent.name} está activo.</p>
				<p className="text-muted-foreground text-sm leading-5">
					Creé el agente de Eve, le apliqué su acceso acotado al CRM y a las
					integraciones, y lo dejé activo para el equipo.
				</p>
			</div>
			<AgentCardShell name={agent.name} status="Activo">
				<div className="flex flex-col gap-2 p-4">
					<ReviewRow
						label="Disparador"
						value={
							nextRun ? (
								<LocalDateTime
									date={nextRun}
									options={{
										weekday: "short",
										hour: "numeric",
										minute: "2-digit",
										timeZoneName: "short",
									}}
								/>
							) : (
								triggerSummary
							)
						}
					/>
					<ReviewRow
						label="Se ejecuta en"
						value="Entorno de Eve · espacio aislado"
					/>
					<ReviewRow
						label="Responsable"
						value={`Equipo · ${agent.createdBy.name}`}
					/>
				</div>
				<AgentCardFooter note="El chat sigue siendo privado. El agente es del equipo.">
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							size="sm"
							disabled={runAction.pending}
							aria-busy={runAction.pending}
							onClick={() => runAction.run()}
						>
							<AsyncButtonContent
								status={runAction.status}
								pendingLabel="Poniendo en cola"
								successLabel="En cola"
								errorLabel="Vuelve a intentarlo"
							>
								<Icon icon={Play} data-icon="inline-start" />
								Ejecutar ahora
							</AsyncButtonContent>
						</Button>
						<Button asChild size="sm">
							<Link href={workspaceUrl(`/agents/${agent.id}`)}>
								Abrir agente
								<Icon icon={ArrowRight} data-icon="inline-end" />
							</Link>
						</Button>
					</div>
				</AgentCardFooter>
			</AgentCardShell>

			<div>
				<p className="flex h-7 items-center text-muted-foreground text-sm">
					Seguimientos sugeridos
				</p>
				{["Agrega a otra persona del equipo a la notificación"].map(
					(suggestion) => (
						<button
							key={suggestion}
							type="button"
							onClick={() => void onFollowUp(suggestion)}
							className="flex w-full items-center gap-3 border-t py-2.5 text-left outline-none hover:bg-muted/50 focus-visible:bg-muted/50"
						>
							<span className="min-w-0 flex-1 wrap-break-word text-sm">
								{suggestion}
							</span>
							<Icon
								icon={ArrowRight}
								className="size-4 text-muted-foreground"
							/>
						</button>
					),
				)}
			</div>
		</div>
	);
}

function ChatUnavailable() {
	const workspaceUrl = useWorkspaceUrl();

	return (
		<main className="flex flex-1 items-center justify-center p-8">
			<div className="max-w-md text-center">
				<h1 className="font-medium text-lg">Chat no disponible</h1>
				<p className="mt-2 text-muted-foreground text-sm">
					Este chat no existe o no tienes acceso a él.
				</p>
				<Button asChild variant="outline" className="mt-5">
					<Link href={workspaceUrl("/chat")}>Empezar un chat nuevo</Link>
				</Button>
			</div>
		</main>
	);
}

const RESOURCE_ICONS = {
	integration: Application,
	company: Building,
	contact: User,
	deal: Partnership,
} as const;

function hasQueuedInputResponse(
	submissions: BuilderSubmission[],
	requestId: string,
): boolean {
	return submissions.some((submission) => {
		if (submission.status === "FAILED" || submission.status === "CANCELLED") {
			return false;
		}

		return submission.message.inputResponse?.requestId === requestId;
	});
}

function questionResponseIds(
	submissions: readonly BuilderSubmission[],
): ReadonlySet<string> {
	return new Set(
		submissions.flatMap((submission) => {
			if (submission.status === "FAILED" || submission.status === "CANCELLED") {
				return [];
			}

			const response = submission.message.inputResponse;
			return response ? [response.requestId] : [];
		}),
	);
}

function retryPromptOf(
	submission: BuilderSubmission | undefined,
): BuilderPrompt | null {
	if (!submission) return null;
	const { message } = submission;
	if (message.inputResponse) return null;
	if (!message.text?.trim()) return null;

	return {
		commandType: submission.commandType,
		message: message.text,
		resources: message.resources,
		attachments: message.attachments,
	};
}

function retryKeyOf(submission: BuilderSubmission): string | null {
	const prompt = retryPromptOf(submission);
	return prompt ? JSON.stringify(prompt) : null;
}

function builderConversationNeedsPolling(conversation: Conversation): boolean {
	return builderConversationIsWorking(conversation);
}

function sharedConversationNeedsPolling(
	conversation: SharedConversation | undefined,
): boolean {
	if (!conversation?.events.length) return false;

	return !eventStreamSettled(conversation.events);
}

function manifestOf(manifest: AgentManifestSummary) {
	return {
		name: manifest.name?.trim() || null,
		trigger:
			manifest.triggers
				.map((trigger) =>
					trigger.type === "MANUAL"
						? "Bajo demanda"
						: compactSummary(
								trigger.summary,
								trigger.type === "EVENT" ? "Con evento del CRM" : "Programada",
							),
				)
				.join(" · ") || "Bajo demanda",
		looksAt: textOf(
			manifest.dataScope.summary,
			"Registros del CRM dentro del alcance aprobado",
		),
		action: compactSummary(
			manifest.actions[0]?.summary,
			"Realizar la acción del equipo solicitada",
		),
		access: manifest.access,
	};
}

function compactSummary(value: string | undefined, fallback: string): string {
	return textOf(value, fallback).replace(/\s+\([^()]+\)\s*\.?$/, "");
}

function textOf(value: string | undefined, fallback: string): string {
	return value?.trim() ? value : fallback;
}
