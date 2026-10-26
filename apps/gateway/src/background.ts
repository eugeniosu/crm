import { errorName, log } from "./log";

export type Background = {
	run(label: string, task: () => Promise<void>): void;
	idle(): Promise<void>;
};

export function createBackground(): Background {
	const pending = new Set<Promise<void>>();

	return {
		run(label, task) {
			const running = task()
				.catch((cause) => {
					log.error(`falló ${label}: ${errorName(cause)}`);
				})
				.finally(() => {
					pending.delete(running);
				});
			pending.add(running);
		},
		async idle() {
			while (pending.size > 0) {
				await Promise.all(pending);
			}
		},
	};
}
