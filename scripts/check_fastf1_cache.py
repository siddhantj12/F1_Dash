import os

CACHE_DIR = 'cache'

def scan_fastf1_cache(cache_dir):
    summary = {}
    if not os.path.exists(cache_dir):
        print(f"Cache directory '{cache_dir}' does not exist.")
        return summary
    for year in sorted(os.listdir(cache_dir)):
        year_path = os.path.join(cache_dir, year)
        if not os.path.isdir(year_path):
            continue
        summary[year] = {}
        for event in sorted(os.listdir(year_path)):
            event_path = os.path.join(year_path, event)
            if not os.path.isdir(event_path):
                continue
            summary[year][event] = []
            for session in sorted(os.listdir(event_path)):
                session_path = os.path.join(event_path, session)
                if os.path.isdir(session_path):
                    summary[year][event].append(session)
    return summary

def print_summary(summary):
    for year in summary:
        print(f"Year: {year}")
        for event in summary[year]:
            sessions = ', '.join(summary[year][event])
            print(f"  Event: {event}")
            print(f"    Sessions: {sessions}")

if __name__ == "__main__":
    summary = scan_fastf1_cache(CACHE_DIR)
    print_summary(summary) 