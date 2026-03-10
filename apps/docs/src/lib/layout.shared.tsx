import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

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
		githubUrl: "https://github.com/deltakithq/deltakit-monorepo",
	};
}
