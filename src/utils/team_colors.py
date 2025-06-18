# Team colors mapping for consistent UI
TEAM_COLORS = {
    "Red Bull Racing": "#0600EF",
    "Mercedes": "#00D2BE",
    "Ferrari": "#DC0000",
    "McLaren": "#FF8700",
    "Alpine": "#0090FF",
    "AlphaTauri": "#2B4562",
    "Aston Martin": "#006F62",
    "Williams": "#005AFF",
    "Alfa Romeo": "#900000",
    "Haas F1 Team": "#FFFFFF",
    "Racing Point": "#F596C8",
    "Renault": "#FFF500",
    "Toro Rosso": "#469BFF",
    "RB": "#6592ff",
    "Kick Sauber": "#52E252",
    "Visa RB": "#6592ff",
    "DEFAULT": "#888888"
}

def get_team_color(team_name: str) -> str:
    """Get the color for a specific team"""
    return TEAM_COLORS.get(team_name, TEAM_COLORS["DEFAULT"]) 