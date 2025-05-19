from django import forms
from .models import BoardGame, Point

class RouteForm(forms.ModelForm):
    class Meta:
        model = BoardGame
        fields = ['name', 'background']

class PointForm(forms.ModelForm):
    x = forms.FloatField(min_value=1, max_value=100, label="X Coordinate")
    y = forms.FloatField(min_value=1, max_value=100, label="Y Coordinate")
    color = forms.CharField(
        max_length=7,
        label="Color",
        widget=forms.TextInput(attrs={"type": "color"})
    )

    class Meta:
        model = Point
        fields = ['x', 'y', 'color']

    def __init__(self, *args, **kwargs):
        self.board = kwargs.pop('board', None)
        super().__init__(*args, **kwargs)

    def clean(self):
        cleaned_data = super().clean()
        x = cleaned_data.get('x')
        y = cleaned_data.get('y')
        color = cleaned_data.get('color')

        if self.board:
            # Check X and Y limits
            if x and x > self.board.cols:
                self.add_error('x', f"X must not exceed number of columns ({self.board.cols})")
            if y and y > self.board.rows:
                self.add_error('y', f"Y must not exceed number of rows ({self.board.rows})")

            # Check for duplicate point at location
            if x is not None and y is not None:
                if Point.objects.filter(route=self.board, x=x, y=y).exists():
                    self.add_error('x', f"A point already exists at ({x}, {y}). Please choose a different location.")

            # Check for too many points of the same color
            if color:
                color_count = Point.objects.filter(route=self.board, color=color).count()
                if color_count >= 2:
                    self.add_error('color', f"Only two points of color {color} are allowed per route.")

        return cleaned_data

