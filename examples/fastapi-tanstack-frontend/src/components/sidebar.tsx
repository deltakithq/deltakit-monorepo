import { SquarePen, MessageCircle } from "lucide-react";
import type { Session } from "#/lib/mock-data";

interface SidebarProps {
	sessions: Session[];
	activeSessionId: number | null;
	onNewChat: () => void;
	onSelectSession: (id: number) => void;
}

export function Sidebar({
	sessions,
	activeSessionId,
	onNewChat,
	onSelectSession,
}: SidebarProps) {
	return (
		<aside className="flex h-full w-64 flex-col border-r border-neutral-800 bg-neutral-900">
			<div className="p-3">
				<button
					type="button"
					onClick={onNewChat}
					className="flex w-full items-center gap-2 rounded-lg border border-neutral-700 px-3 py-2.5 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
				>
					<SquarePen size={16} />
					New chat
				</button>
			</div>

			<nav className="flex-1 overflow-y-auto px-2 pb-3">
				<div className="space-y-0.5">
					{sessions.map((session) => (
						<button
							key={session.id}
							type="button"
							onClick={() => onSelectSession(session.id)}
							className={`flex w-full items-start gap-2.5 rounded-lg px-3 py-2.5 text-left text-sm transition-colors ${
								activeSessionId === session.id
									? "bg-neutral-800 text-neutral-100"
									: "text-neutral-400 hover:bg-neutral-800/50 hover:text-neutral-200"
							}`}
						>
							<MessageCircle size={16} className="mt-0.5 shrink-0" />
							<span className="truncate">{session.title}</span>
						</button>
					))}
				</div>
			</nav>
		</aside>
	);
}
