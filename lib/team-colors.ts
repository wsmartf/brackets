export const TEAM_COLORS: Record<string, string> = {
  Duke: "#003087",
  Michigan: "#FFCB05",
  Houston: "#C8102E",
  Arizona: "#AB0520",
  Iowa: "#FFCD00",
  "Iowa State": "#C8102E",
  Alabama: "#9E1B32",
  Purdue: "#CFB991",
  Tennessee: "#FF8200",
  Illinois: "#E84A27",
};

export function getTeamAccentColor(team: string): string {
  return TEAM_COLORS[team] ?? "rgba(255,255,255,0.3)";
}
