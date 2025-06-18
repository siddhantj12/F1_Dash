# Track figure - make it fit initial screen and move up
fig_track = Figure(figsize=(16, 6), facecolor='black')
gs_track = fig_track.add_gridspec(2, 1,  
                                height_ratios=[0.08, 1.0],  # Reduced title height ratio
                                hspace=0.02)  # Reduced space between title and track

# Add track info at top with smaller font and moved up
ax_info.text(0.5, 0.8, f"{track_name}\nLap {lap_num}",  # Moved text further up
             transform=ax_info.transAxes,
             color='white', fontsize=14, fontweight='bold',  # Slightly smaller font
             ha='center', va='center',
             bbox=dict(facecolor='black', alpha=0.7, 
                      edgecolor='white', pad=3))  # Reduced padding

# Create frame for track view with adjusted padding
track_frame = ttk.Frame(self.telemetry_frame)
track_frame.pack(fill="both", expand=True, pady=(0, 20))  # Removed top padding