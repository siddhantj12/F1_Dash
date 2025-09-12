# TEAM_COLORS = {
#     2024: {
#         "HAM": "#6CD3BF",
#         "RUS": "#6CD3BF",  # Mercedes
#         "VER": "#3671C6",
#         "PER": "#3671C6",  # Red Bull
#         # ... (rest of your team colors)
#     }
# }

# def get_team_color(team_name, year):
#     # Fallback color for unknown teams or years
#     default_color = "#888888"
    
#     # Get colors for the specific year, or fallback to 2024 if not found
#     year_colors = TEAM_COLORS.get(year, TEAM_COLORS.get(2024, {}))
    
#     # Try to find the color by exact team name
#     color = year_colors.get(team_name)
    
#     # If not found by exact name, try to find by driver code (if team_name is a driver code)
#     if color is None:
#         for driver_code, driver_color in year_colors.items():
#             if team_name.upper() == driver_code.upper():
#                 color = driver_color
#                 break
    
#     return color if color is not None else default_color