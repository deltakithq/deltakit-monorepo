import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";
import { BookOpen } from "lucide-react";

export function baseOptions(): BaseLayoutProps {
	return {
		nav: {
			title: (
				<>
					<img src="/deltakit.png" alt="DeltaKit" width={24} height={24} />
					DeltaKit
				</>
			),
		},
		links: [
			{
				text: "Documentation",
				url: "/docs/react",
				icon: <BookOpen />,
			},
		],
		githubUrl: "https://github.com/deltakithq/deltakit-monorepo",
	};
}
