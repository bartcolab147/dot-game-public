from django.contrib import admin
from .models import BackgroundImage
from django.utils.html import mark_safe
from django.db.models import Count

@admin.register(BackgroundImage)
class BackgroundImageAdmin(admin.ModelAdmin):
    list_display = ['image_thumbnail', 'name', 'route_count', 'width', 'height']
    list_editable = ('name',)
    list_display_links = ('image_thumbnail',)
    search_fields = ('name',)
    ordering = ('name',)

    def image_thumbnail(self, obj):
        if obj.image:
            return mark_safe(f'<img src="{obj.image.url}" width="50" height="50" />')  # Show thumbnail of the image
        return "No image"  # In case the image is missing or not set
    image_thumbnail.short_description = 'Image'