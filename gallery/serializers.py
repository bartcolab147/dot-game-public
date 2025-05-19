# START OF FILE serializers.py (Updated PathSerializer context)
from rest_framework import serializers
from .models import BoardGame, Point, GamePlaySession, Path, BackgroundImage # Ensure all models are imported
from django.core.exceptions import ValidationError as DjangoValidationError

class BackgroundImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = BackgroundImage
        fields = ['id', 'name', 'image', 'width', 'height']

class PointSerializer(serializers.ModelSerializer):
    board = serializers.PrimaryKeyRelatedField(
        queryset=BoardGame.objects.all(),
        source='route'
    )

    class Meta:
        model = Point
        fields = ['id', 'x', 'y', 'board', 'color']

    def validate(self, data):
        board_instance = data.get('route') # Access using 'source' name
        if not board_instance and self.instance:
            board_instance = self.instance.route
        
        if not board_instance:
            raise serializers.ValidationError({"board": "Board (route) is required."})

        x_val = data.get('x', getattr(self.instance, 'x', None))
        y_val = data.get('y', getattr(self.instance, 'y', None))

        if self.instance is None:
            if x_val is None or y_val is None:
                raise serializers.ValidationError("x and y coordinates are required to create a point.")
        
        if 'x' in data or self.instance is None:
            if not (1 <= x_val <= board_instance.cols):
                raise serializers.ValidationError(
                    {"x": f"x must be between 1 and {board_instance.cols} (got {x_val})."}
                )

        if 'y' in data or self.instance is None:
            if not (1 <= y_val <= board_instance.rows):
                raise serializers.ValidationError(
                    {"y": f"y must be between 1 and {board_instance.rows} (got {y_val})."}
                )
        return data

class BoardSerializer(serializers.ModelSerializer):
    points = PointSerializer(many=True, read_only=True)
    class Meta:
        model = BoardGame
        fields = ['id', 'name', 'background', 'points', 'rows', 'cols', 'auto_save_enabled', 'user']


# --- Gameplay Serializers ---
class PathSerializer(serializers.ModelSerializer):
    # game_play_session will be set by the view context during bulk save
    # so it doesn't need to be in request data for each path.
    game_play_session = serializers.PrimaryKeyRelatedField(queryset=GamePlaySession.objects.all(), required=False)

    class Meta:
        model = Path
        fields = ['id', 'game_play_session', 'color', 'path_data']
        # Make game_play_session write_only or exclude if always set by view context
        extra_kwargs = {
            'game_play_session': {'write_only': True, 'required': False} 
        }


    def validate_path_data(self, value):
        if not isinstance(value, list) or not value:
            raise serializers.ValidationError("Path data must be a non-empty list.")
        if len(value) < 2:
            raise serializers.ValidationError("Path data must contain at least two coordinates.")
        for i, item in enumerate(value):
            if not (isinstance(item, dict) and 
                    'x' in item and 'y' in item and
                    isinstance(item['x'], int) and isinstance(item['y'], int)):
                raise serializers.ValidationError(
                    f"Path segment {i} is invalid. Expecting {{'x': int, 'y': int}}."
                )
        return value

    def validate(self, data):
        # Model's clean method will be called before saving.
        # Ensure `game_play_session` is available in the context if not in data
        if 'game_play_session' not in data and 'view' in self.context and hasattr(self.context['view'], 'game_session_instance'):
             pass # Will be added in the view
        elif 'game_play_session' not in data and not (self.instance and self.instance.game_play_session):
             raise serializers.ValidationError({"game_play_session": "GamePlaySession is required."})

        return data


class GamePlaySessionSerializer(serializers.ModelSerializer):
    paths = PathSerializer(many=True, read_only=True)
    player_username = serializers.CharField(source='player.username', read_only=True)
    board_game_name = serializers.CharField(source='board_game.name', read_only=True)
    board_details = serializers.SerializerMethodField(read_only=True)

    class Meta:
        model = GamePlaySession
        fields = [
            'id', 'player', 'player_username', 'board_game', 'board_game_name', 
            'is_solved', 'last_updated', 'paths', 'board_details'
        ]
        read_only_fields = ['player', 'board_game', 'last_updated'] # is_solved might be updatable by check_solve

    def get_board_details(self, obj: GamePlaySession):
        board = obj.board_game
        points_queryset = Point.objects.filter(route=board) # Ensure we get points for this board
        points_data = PointSerializer(points_queryset, many=True).data
        
        frontend_points = [{
            "id": p_data["id"], "x": p_data["x"], "y": p_data["y"], "color": p_data["color"]
        } for p_data in points_data]

        return {
            'route': {
                'id': board.id, 'name': board.name, 'rows': board.rows, 'cols': board.cols,
                'auto_save_enabled': board.auto_save_enabled,
            },
            'points': frontend_points
        }