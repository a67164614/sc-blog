// Fallback snapshot used until the CMS publisher exports a settings file.
export type CmsSettingsSnapshot = {
	identity?: {
		title?: string;
		subtitle?: string;
		description?: string;
		siteUrl?: string;
		favicon?: string;
		logoLight?: string;
		logoDark?: string;
	};
	appearance?: { themeColor?: string; hue?: number; colorMode?: "light" | "dark" | "system" };
};

export const cmsSettings: CmsSettingsSnapshot | null = null;
