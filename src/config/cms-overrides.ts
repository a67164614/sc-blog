import type { SiteConfig } from "@/types/siteConfig";
import { cmsSettings } from "@/generated/cms-settings";

function hueFromHex(value: string | undefined): number | undefined {
	if (!value) return undefined;
	const match = /^#?([0-9a-f]{6})$/i.exec(value.trim());
	if (!match) return undefined;
	const channels = [0, 2, 4].map((offset) => Number.parseInt(match[1].slice(offset, offset + 2), 16) / 255);
	const [red, green, blue] = channels;
	const max = Math.max(red, green, blue);
	const min = Math.min(red, green, blue);
	if (max === min) return 0;
	const delta = max - min;
	let hue = red === max ? (green - blue) / delta : green === max ? 2 + (blue - red) / delta : 4 + (red - green) / delta;
	hue = Math.round(hue * 60);
	return hue < 0 ? hue + 360 : hue;
}

export function applyCmsSiteOverrides(defaults: SiteConfig): SiteConfig {
	const identity = cmsSettings?.identity;
	const appearance = cmsSettings?.appearance;
	if (!identity && !appearance) return defaults;

	const logo = (value: string | undefined, fallback: SiteConfig["navbar"]["logo"]) => value
		? { type: "image" as const, value, alt: defaults.navbar.title }
		: fallback;
	const hue = appearance?.hue ?? hueFromHex(appearance?.themeColor);

	return {
		...defaults,
		title: identity?.title ?? defaults.title,
		subtitle: identity?.subtitle ?? defaults.subtitle,
		description: identity?.description ?? defaults.description,
		site_url: identity?.siteUrl ?? defaults.site_url,
		favicon: identity?.favicon ? [{ src: identity.favicon }] : defaults.favicon,
		themeColor: {
			...defaults.themeColor,
			...(hue === undefined ? {} : { hue }),
			...(appearance?.colorMode ? { defaultMode: appearance.colorMode } : {}),
		},
		navbar: {
			...defaults.navbar,
			title: identity?.title ?? defaults.navbar.title,
			logo: logo(identity?.logoLight, defaults.navbar.logo),
		},
	};
}
