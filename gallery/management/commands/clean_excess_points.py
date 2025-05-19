from django.core.management.base import BaseCommand
from collections import defaultdict
from gallery.models import Point

class Command(BaseCommand):
    help = "Removes excessive points, keeping only 2 of each color per route."

    def handle(self, *args, **kwargs):
        self.stdout.write("Cleaning excessive points...")

        # Group points by (route, color)
        points = Point.objects.all().order_by('id')  # Oldest first
        point_groups = defaultdict(list)

        for point in points:
            key = (point.route_id, point.color)
            point_groups[key].append(point)

        deleted_count = 0

        for (route_id, color), group in point_groups.items():
            if len(group) > 2:
                # Keep the first two, delete the rest
                to_delete = group[2:]
                count = len(to_delete)
                Point.objects.filter(id__in=[p.id for p in to_delete]).delete()
                deleted_count += count
                self.stdout.write(f"Deleted {count} excess points for route {route_id}, color {color}")

        self.stdout.write(self.style.SUCCESS(f"Done. Deleted {deleted_count} excessive points."))
