export function sanitizeUrl(url: string): string {
	if (!url) return "";

	const trimmed = url.trim().toLowerCase();

	if (trimmed.startsWith("javascript:")) {
		return "";
	}

	if (trimmed.startsWith("data:") && !trimmed.startsWith("data:image/")) {
		return "";
	}

	if (trimmed.startsWith("vbscript:")) {
		return "";
	}

	return url;
}
