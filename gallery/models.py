from django.db import models
from django.contrib.auth.models import User
from PIL import Image
from django.core.exceptions import ValidationError
from django.db.models import JSONField
from django.db.models.signals import post_delete # Import post_delete
from django.dispatch import receiver # Already imported in the original file but good to ensure

class BackgroundImage(models.Model):
    image = models.ImageField(upload_to='backgrounds/')
    name = models.CharField(max_length=100)
    width = models.PositiveIntegerField(editable=False, null=True)
    height = models.PositiveIntegerField(editable=False, null=True)

    def save(self, *args, **kwargs):
        super().save(*args, **kwargs)

        if self.image and hasattr(self.image, 'path'):
            try:
                img = Image.open(self.image.path)
                current_width, current_height = img.size

                if self.width != current_width or self.height != current_height:
                    self.width = current_width
                    self.height = current_height
                    BackgroundImage.objects.filter(pk=self.pk).update(width=self.width, height=self.height)
            except FileNotFoundError:
                if self.width is not None or self.height is not None:
                    self.width = None
                    self.height = None
                    BackgroundImage.objects.filter(pk=self.pk).update(width=self.width, height=self.height)
                pass
            except Exception as e:
                if self.width is not None or self.height is not None:
                    self.width = None
                    self.height = None
                    BackgroundImage.objects.filter(pk=self.pk).update(width=self.width, height=self.height)
                pass

    def __str__(self):
        return self.name
    
    def route_count(self):
        return self.boardgame_set.count()

class BoardGame(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    background = models.ForeignKey(BackgroundImage, on_delete=models.CASCADE)
    name = models.CharField(max_length=100)
    cols = models.IntegerField(default=6)
    rows = models.IntegerField(default=6)
    auto_save_enabled = models.BooleanField(default=False) 

    def __str__(self):
        return f"{self.name} ({self.user.username})"

    def save(self, *args, **kwargs):
        # Validate dimensions
        if not (1 <= self.cols <= 12):
            raise ValidationError("Cols must be between 1 and 12.")
        if not (1 <= self.rows <= 12):
            raise ValidationError("Rows must be between 1 and 12.")

        original_cols_from_db, original_rows_from_db = None, None
        is_update_and_fetched_originals = False

        if self.pk is not None: # If instance is being updated
            try:
                original_instance = BoardGame.objects.get(pk=self.pk)
                original_cols_from_db = original_instance.cols
                original_rows_from_db = original_instance.rows
                is_update_and_fetched_originals = True
            except BoardGame.DoesNotExist:
                # Should not happen if self.pk is not None, but proceed as if it's not an update
                # for dimension change logic if original state can't be fetched.
                pass 
        
        super().save(*args, **kwargs) # self.cols and self.rows are now the new values

        if is_update_and_fetched_originals:
            board_shrank_cols = self.cols < original_cols_from_db
            board_shrank_rows = self.rows < original_rows_from_db

            if board_shrank_cols or board_shrank_rows:
                # Delete points that are now out of bounds due to dimension change.
                # The post_delete signal on Point model will handle resetting game sessions.
                out_of_bounds_points_q = models.Q(x__gt=self.cols) | models.Q(y__gt=self.rows)
                points_to_be_deleted_directly = self.points.filter(out_of_bounds_points_q)
                
                colors_of_directly_deleted_points = set(
                    points_to_be_deleted_directly.values_list('color', flat=True)
                )
                
                if points_to_be_deleted_directly.exists():
                    points_to_be_deleted_directly.delete() # This triggers post_delete signals
                    
                    # If a point was deleted, and its pair remains, delete the pair too
                    if colors_of_directly_deleted_points:
                        for color in colors_of_directly_deleted_points:
                            remaining_points_in_color_group = self.points.filter(color=color)
                            if remaining_points_in_color_group.count() == 1:
                                # This deletion will also trigger post_delete signal for each point
                                remaining_points_in_color_group.delete()
                # NOTE: No explicit call to session.reset_progress() here.
                # It's handled by the Point post_delete signal.

class Point(models.Model):
    route = models.ForeignKey(BoardGame, on_delete=models.CASCADE, related_name='points')
    x = models.IntegerField()
    y = models.IntegerField()
    color = models.CharField(max_length=7, default="#000000")

    class Meta:
        unique_together = ('route', 'x', 'y') 
        ordering = ['route', 'color', 'id']

    def __str__(self):
        return f"Point ({self.x}, {self.y}) - {self.color} on {self.route.name}"

    def clean(self):
        super().clean() 

        if self.route:
            if not (1 <= self.x <= self.route.cols and 1 <= self.y <= self.route.rows):
                raise ValidationError(f"Point coordinates ({self.x}, {self.y}) are out of board bounds ({self.route.cols}x{self.route.rows}).")

        if self.route and self.color:
            existing_points_with_color = Point.objects.filter(route=self.route, color=self.color)
            if self.pk: 
                existing_points_with_color = existing_points_with_color.exclude(pk=self.pk)
            
            if existing_points_with_color.count() >= 2:
                raise ValidationError(f"Only two points of color {self.color} are allowed per route. Found {existing_points_with_color.count()} existing.")
        
        if self.route:
            conflicting_point_at_coords = Point.objects.filter(route=self.route, x=self.x, y=self.y)
            if self.pk:
                conflicting_point_at_coords = conflicting_point_at_coords.exclude(pk=self.pk)
            if conflicting_point_at_coords.exists():
                 raise ValidationError(f"Another point already exists at ({self.x}, {self.y}) on this board.")

    def save(self, *args, **kwargs):
        is_new = not self.pk
        original_x, original_y, original_color = None, None, None
        trigger_session_reset = False

        if not is_new: # If updating an existing point
            try:
                original_point_obj = Point.objects.get(pk=self.pk)
                original_x = original_point_obj.x
                original_y = original_point_obj.y
                original_color = original_point_obj.color
            except Point.DoesNotExist:
                # Should not happen if self.pk is valid. If it does, we can't compare,
                # so only `is_new` would trigger reset.
                pass
        
        self.full_clean() # Run all validations
        super().save(*args, **kwargs) # Point is saved. self.x, self.y, self.color are current.

        if is_new:
            trigger_session_reset = True
        # Check if original values were fetched (i.e., it was an update and DB state was retrieved)
        elif original_x is not None and original_y is not None and original_color is not None:
            if self.x != original_x or \
               self.y != original_y or \
               self.color != original_color:
                trigger_session_reset = True

        if trigger_session_reset:
            if self.route: # Ensure route is set
                for session in self.route.play_sessions.all():
                    session.reset_progress()

# --- New Models for Gameplay ---

class GamePlaySession(models.Model):
    player = models.ForeignKey(User, on_delete=models.CASCADE, related_name='game_sessions')
    board_game = models.ForeignKey(BoardGame, on_delete=models.CASCADE, related_name='play_sessions')
    is_solved = models.BooleanField(default=False)
    last_updated = models.DateTimeField(auto_now=True)

    class Meta:
        unique_together = ('player', 'board_game')
        ordering = ['-last_updated']

    def __str__(self):
        return f"{self.player.username}'s session on '{self.board_game.name}' (Solved: {self.is_solved})"

    def reset_progress(self):
        self.paths.all().delete() 
        
        was_solved_before_reset = self.is_solved 
        
        if self.is_solved:
            self.is_solved = False
            
        fields_to_update = ['last_updated']
        if was_solved_before_reset: 
            fields_to_update.append('is_solved')
        
        self.save(update_fields=fields_to_update)

class Path(models.Model):
    game_play_session = models.ForeignKey(GamePlaySession, on_delete=models.CASCADE, related_name='paths')
    color = models.CharField(max_length=7)
    path_data = JSONField() 

    class Meta:
        unique_together = ('game_play_session', 'color')
        ordering = ['game_play_session', 'color']

    def __str__(self):
        return (f"Path for color {self.color} in session for "
                f"{self.game_play_session.player.username} on '{self.game_play_session.board_game.name}'")

    def clean(self):
        super().clean()

        if not self.game_play_session_id:
            raise ValidationError("Path must be associated with a game play session.")

        board_game = self.game_play_session.board_game
        points_of_color = Point.objects.filter(route=board_game, color=self.color)
        if points_of_color.count() == 0:
            raise ValidationError(f"No points found for color {self.color} on the board '{board_game.name}'.")
        if points_of_color.count() != 2:
            raise ValidationError(
                f"Board '{board_game.name}' must have exactly two points for color {self.color}. "
                f"Found {points_of_color.count()}."
            )

        if not isinstance(self.path_data, list) or not self.path_data:
            raise ValidationError("Path data must be a non-empty list of coordinate dictionaries.")
        if len(self.path_data) < 2:
            raise ValidationError("Path data must contain at least two coordinates (start and end points).")

        for i, coord_dict in enumerate(self.path_data):
            if not (isinstance(coord_dict, dict) and 
                    'x' in coord_dict and 'y' in coord_dict and
                    isinstance(coord_dict['x'], int) and isinstance(coord_dict['y'], int)):
                raise ValidationError(
                    f"Path segment {i} ({coord_dict}) is not a valid integer coordinate dictionary like {{'x': X, 'y': Y}}."
                )
            x, y = coord_dict['x'], coord_dict['y']
            if not (1 <= x <= board_game.cols and 1 <= y <= board_game.rows):
                raise ValidationError(
                    f"Path segment {i} ({x}, {y}) is out of board bounds ({board_game.cols}x{board_game.rows})."
                )

        start_coord_data = self.path_data[0]
        end_coord_data = self.path_data[-1]
        p1 = points_of_color.first()
        p2 = points_of_color.last()

        path_starts_on_p1 = (start_coord_data['x'] == p1.x and start_coord_data['y'] == p1.y)
        path_ends_on_p2 = (end_coord_data['x'] == p2.x and end_coord_data['y'] == p2.y)
        path_starts_on_p2 = (start_coord_data['x'] == p2.x and start_coord_data['y'] == p2.y)
        path_ends_on_p1 = (end_coord_data['x'] == p1.x and end_coord_data['y'] == p1.y)

        if not ((path_starts_on_p1 and path_ends_on_p2) or (path_starts_on_p2 and path_ends_on_p1)):
            raise ValidationError(
                f"Path for color {self.color} does not start and end on the correct point pair. "
                f"Board points for this color: ({p1.x},{p1.y}) and ({p2.x},{p2.y}). "
                f"Path data endpoints: ({start_coord_data['x']},{start_coord_data['y']}) and "
                f"({end_coord_data['x']},{end_coord_data['y']})."
            )

        for i in range(len(self.path_data) - 1):
            curr = self.path_data[i]
            next_ = self.path_data[i+1]
            dx = abs(curr['x'] - next_['x'])
            dy = abs(curr['y'] - next_['y'])
            if not ((dx == 1 and dy == 0) or (dx == 0 and dy == 1)):
                raise ValidationError(
                    f"Path for color {self.color} is not contiguous. "
                    f"Segment from ({curr['x']},{curr['y']}) to ({next_['x']},{next_['y']}) is invalid."
                )

        path_coords_as_tuples = [(seg['x'], seg['y']) for seg in self.path_data]
        if len(path_coords_as_tuples) != len(set(path_coords_as_tuples)):
            raise ValidationError(
                f"Path for color {self.color} self-intersects (visits the same cell more than once)."
            )

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)
        if self.game_play_session:
            self.game_play_session.save(update_fields=['last_updated'])

# Signal handler for Point deletion
@receiver(post_delete, sender=Point)
def point_post_delete_handler(sender, instance, **kwargs):
    """
    When a Point is deleted, reset progress for all game sessions on its board.
    """
    try:
        board = instance.route
        # The board (instance.route) should generally exist due to ForeignKey(on_delete=CASCADE)
        # behavior, but a check is safe.
        if board:
            # If the board itself is in the process of being deleted, its play_sessions
            # will also be cascade-deleted. Calling reset_progress on sessions that
            # are about to be deleted is redundant but generally harmless.
            for session in board.play_sessions.all(): # play_sessions is related_name
                session.reset_progress()
    except BoardGame.DoesNotExist:
        # This might occur if the board was deleted before or around the same time
        # this signal is processed. In such a case, related sessions are likely gone too.
        pass
    # No explicit catch for GamePlaySession.DoesNotExist as .all() on a related manager
    # will simply return an empty queryset if the board itself has no sessions or is gone.