# START OF FILE views.py

from django.shortcuts import render, get_object_or_404, redirect
from .models import BackgroundImage, Point, BoardGame
from django.contrib.auth.decorators import login_required
from django.views.decorators.http import require_http_methods
from django.views.decorators.csrf import csrf_exempt
from .forms import PointForm

from django.http import JsonResponse
import json
from django.core.exceptions import ValidationError
from django.db import transaction # For batch saving


from django.urls import reverse

# Added @login_required if it was missing and seems appropriate
# Added @require_http_methods if it was missing and the view implies specific methods

@login_required
def route_list(request):
    return render(request, 'gallery/route_list.html')


@login_required
def view_route(request, route_id):
    route = get_object_or_404(BoardGame, id=route_id, user=request.user)
    form = PointForm(board=route)

    if request.method == 'POST' and 'add_point' in request.POST:
        point_form = PointForm(request.POST, board=route)
        if point_form.is_valid():
            new_point = point_form.save(commit=False)
            new_point.route = route
            new_point.save()
            return redirect(f'{reverse("gallery:view_route", args=[route.id])}?panel=form&point_added_id={new_point.id}')
        else:
            form = point_form

    return render(request, 'gallery/view_route.html', {
        'route': route,
        'form': form,
    })

@login_required
@require_http_methods(["DELETE"])
@csrf_exempt
def delete_point_api(request, point_id):
    try:
        point_to_delete = get_object_or_404(Point, id=point_id, route__user=request.user)
        board_id = point_to_delete.route.id
        color_of_deleted_point = point_to_delete.color
        Point.objects.filter(route_id=board_id, color=color_of_deleted_point).delete()
        return JsonResponse({"success": True, "message": f"Points with color {color_of_deleted_point} deleted."})
    except Point.DoesNotExist:
        return JsonResponse({"error": "Point not found or permission denied."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["PUT"])
def update_point(request, route_id, point_id):
    route = get_object_or_404(BoardGame, id=route_id, user=request.user)
    if not route.auto_save_enabled:
        return JsonResponse({"error": "Auto-save is not enabled. Use batch save.", "auto_save_off": True}, status=400)

    try:
        data = json.loads(request.body)
        point = get_object_or_404(Point, id=point_id, route=route)

        new_x, new_y = data["x"], data["y"]
        if route.points.filter(x=new_x, y=new_y).exclude(id=point_id).exists():
            return JsonResponse({"error": f"Cell ({new_x}, {new_y}) is already occupied by another point."}, status=400)

        point.x = new_x
        point.y = new_y
        point.save()
        return JsonResponse({"success": True, "id": point.id, "x": point.x, "y": point.y, "color": point.color})
    except Point.DoesNotExist:
        return JsonResponse({"error": "Point not found"}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except ValidationError as ve:
        return JsonResponse({"error": ", ".join(ve.messages)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def add_points(request, route_id):
    route = get_object_or_404(BoardGame, id=route_id, user=request.user)
    if not route.auto_save_enabled:
        return JsonResponse({"error": "Auto-save is not enabled. Use batch save.", "auto_save_off": True}, status=400)

    try:
        data = json.loads(request.body)
        points_data = data.get("points", [])
        if len(points_data) != 2:
            return JsonResponse({"error": "You must provide exactly two points."}, status=400)
        for p_data in points_data:
            if not all(k in p_data for k in ("x", "y", "color")):
                return JsonResponse({"error": "Each point must have x, y, and color attributes."}, status=400)

        color_to_add = points_data[0]["color"]
        if route.points.filter(color=color_to_add).count() > 0:
             return JsonResponse({"error": f"Color {color_to_add} already has points. Delete them first or choose a different color."}, status=400)

        created_points_response = []
        with transaction.atomic():
            for p_data in points_data:
                if not (1 <= p_data["x"] <= route.cols and 1 <= p_data["y"] <= route.rows):
                    raise ValidationError(f"Point coordinates ({p_data['x']}, {p_data['y']}) are out of bounds.")
                if route.points.filter(x=p_data["x"], y=p_data["y"]).exists():
                    raise ValidationError(f"Cell ({p_data['x']},{p_data['y']}) is already occupied.")

                point_obj = Point.objects.create(
                    route=route, x=p_data["x"], y=p_data["y"], color=p_data["color"]
                )
                created_points_response.append({"id": point_obj.id, "x": point_obj.x, "y": point_obj.y, "color": point_obj.color})

        return JsonResponse({"success": True, "points": created_points_response})

    except BoardGame.DoesNotExist:
        return JsonResponse({"error": "Board not found or permission denied."}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON data"}, status=400)
    except ValidationError as ve:
        return JsonResponse({"error": ", ".join(ve.messages)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["PUT"])
def toggle_board_autosave(request, board_id):
    try:
        board = get_object_or_404(BoardGame, id=board_id, user=request.user)
        data = json.loads(request.body)
        new_status = data.get('auto_save_enabled')

        if not isinstance(new_status, bool):
            return JsonResponse({"error": "Invalid 'auto_save_enabled' value. Must be boolean."}, status=400)

        board.auto_save_enabled = new_status
        board.save(update_fields=['auto_save_enabled'])
        return JsonResponse({'status': 'success', 'auto_save_enabled': board.auto_save_enabled})
    except BoardGame.DoesNotExist:
        return JsonResponse({"error": "Board not found or permission denied."}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def save_pending_changes(request, route_id):
    route = get_object_or_404(BoardGame, id=route_id, user=request.user)
    try:
        data = json.loads(request.body)
        changes = data.get('changes', [])

        results = []
        with transaction.atomic():
            for change_idx, change in enumerate(changes):
                change_type = change.get('type')

                if change_type == 'add':
                    points_to_add = change.get('points', [])
                    if len(points_to_add) != 2:
                        raise ValidationError(f"[Change {change_idx+1}]: Add operation requires exactly two points.")

                    color_to_add = points_to_add[0].get('color')
                    is_overall_deleted_in_batch = any(
                        c.get('type') == 'delete' and c.get('color') == color_to_add for c in changes
                    )
                    if route.points.filter(color=color_to_add).exists() and not is_overall_deleted_in_batch:
                        raise ValidationError(f"[Change {change_idx+1}]: Color {color_to_add} already has points in the database or pending add, and is not marked for deletion in this batch.")

                    added_pair_details = []
                    for p_data in points_to_add:
                        if not all(k in p_data for k in ("x", "y", "color")):
                            raise ValidationError(f"[Change {change_idx+1}]: Each point in add operation must have x, y, color.")
                        if not (1 <= p_data["x"] <= route.cols and 1 <= p_data["y"] <= route.rows):
                            raise ValidationError(f"[Change {change_idx+1}]: Point ({p_data['x']},{p_data['y']}) out of current board bounds ({route.cols}x{route.rows}).")

                        if route.points.filter(x=p_data["x"], y=p_data["y"]).exists():
                            occupying_point_db = route.points.filter(x=p_data["x"], y=p_data["y"]).first()
                            occupying_point_id = occupying_point_db.id if occupying_point_db else None

                            is_occupier_being_moved_or_deleted_in_batch = False
                            if occupying_point_id:
                                is_occupier_being_moved_or_deleted_in_batch = any(
                                    (c.get('type') == 'update' and str(c.get('pointId')) == str(occupying_point_id) and (c.get('x') != p_data["x"] or c.get('y') != p_data["y"])) or
                                    (c.get('type') == 'delete' and str(c.get('pointId')) == str(occupying_point_id)) 
                                    for c in changes
                                )
                            if not is_occupier_being_moved_or_deleted_in_batch:
                                raise ValidationError(f"[Change {change_idx+1}]: Cell ({p_data['x']},{p_data['y']}) is already occupied by a point not being moved/deleted in this batch.")

                        point_obj = Point.objects.create(
                            route=route, x=p_data['x'], y=p_data['y'], color=p_data['color']
                        )
                        added_pair_details.append({"id": point_obj.id, "x": point_obj.x, "y": point_obj.y, "color": point_obj.color})

                    results.append({"type": "add", "success": True, "points": added_pair_details})

                elif change_type == 'update':
                    point_id_str = str(change.get('pointId'))
                    new_x, new_y = change.get('x'), change.get('y')

                    try:
                        point_id = int(point_id_str)
                    except ValueError:
                        raise ValidationError(f"[Change {change_idx+1}]: Update operation received a non-numeric pointId '{point_id_str}'. Batch updates only support persisted points.")

                    if new_x is None or new_y is None:
                        raise ValidationError(f"[Change {change_idx+1}]: Update operation missing x or y.")
                    if not (1 <= new_x <= route.cols and 1 <= new_y <= route.rows):
                        raise ValidationError(f"[Change {change_idx+1}]: New coordinates ({new_x},{new_y}) for point {point_id} are out of current board bounds ({route.cols}x{route.rows}).")

                    point_to_update = get_object_or_404(Point, id=point_id, route=route)

                    if route.points.filter(x=new_x, y=new_y).exclude(id=point_id).exists():
                        occupying_point_on_db = route.points.filter(x=new_x, y=new_y).exclude(id=point_id).first()
                        if occupying_point_on_db:
                            occupying_point_id = occupying_point_on_db.id
                            is_occupier_being_moved_or_deleted_in_batch = any(
                                (c.get('type') == 'update' and str(c.get('pointId')) == str(occupying_point_id) and (c.get('x') != new_x or c.get('y') != new_y)) or
                                (c.get('type') == 'delete' and str(c.get('pointId')) == str(occupying_point_id)) 
                                for c in changes if str(c.get('pointId')) != str(point_id)
                            )
                            if not is_occupier_being_moved_or_deleted_in_batch:
                                raise ValidationError(f"[Change {change_idx+1}]: Cell ({new_x},{new_y}) for point {point_id} is already occupied by another point ({occupying_point_id}) not being moved/deleted in this batch.")

                    point_to_update.x = new_x
                    point_to_update.y = new_y
                    point_to_update.save()
                    results.append({"type": "update", "success": True, "id": point_to_update.id, "x": point_to_update.x, "y": point_to_update.y, "color": point_to_update.color})

                elif change_type == 'delete':
                    point_id_to_delete_str = str(change.get('pointId')) 
                    if point_id_to_delete_str is None: 
                        raise ValidationError(f"[Change {change_idx+1}]: Delete operation missing pointId.")

                    try:
                        point_id_to_delete = int(point_id_to_delete_str)
                        point_instance_to_delete = Point.objects.get(id=point_id_to_delete, route=route)
                        color_group_to_remove = point_instance_to_delete.color
                        deleted_count, _ = Point.objects.filter(route=route, color=color_group_to_remove).delete()
                        if deleted_count > 0:
                            results.append({"type": "delete", "success": True, "color_deleted": color_group_to_remove, "ids_affected_estimate": deleted_count})
                        else:
                            results.append({"type": "delete", "success": True, "message": f"No points found for color {color_group_to_remove} (source ID {point_id_to_delete_str}) to delete, possibly already processed."})
                    except Point.DoesNotExist:
                        results.append({"type": "delete", "success": True, "message": f"Point ID {point_id_to_delete_str} not found for deletion, possibly already deleted by a prior operation in this batch."})
                    except ValueError: 
                        raise ValidationError(f"[Change {change_idx+1}]: Delete operation received a non-numeric pointId '{point_id_to_delete_str}'. Batch deletes only support persisted points.")


                elif change_type == 'update_name':
                    new_name = change.get('newName')
                    if not new_name or not isinstance(new_name, str) or len(new_name.strip()) == 0:
                        raise ValidationError(f"[Change {change_idx+1}]: New name cannot be empty.")
                    if len(new_name) > 100:
                        raise ValidationError(f"[Change {change_idx+1}]: New name is too long (max 100 characters).")
                    route.name = new_name.strip()
                    route.save(update_fields=['name'])
                    results.append({"type": "update_name", "success": True, "newName": route.name})

                elif change_type == 'update_dimensions':
                    new_cols = change.get('newCols')
                    new_rows = change.get('newRows')
                    if not (isinstance(new_cols, int) and 1 <= new_cols <= 12):
                        raise ValidationError(f"[Change {change_idx+1}]: Cols must be an integer between 1 and 12.")
                    if not (isinstance(new_rows, int) and 1 <= new_rows <= 12):
                        raise ValidationError(f"[Change {change_idx+1}]: Rows must be an integer between 1 and 12.")
                    route.cols = new_cols
                    route.rows = new_rows
                    route.save(update_fields=['cols', 'rows']) 
                    results.append({"type": "update_dimensions", "success": True, "newCols": route.cols, "newRows": route.rows})

                else:
                    raise ValidationError(f"[Change {change_idx+1}]: Unknown change type: {change_type}")

        all_current_points = list(route.points.all().order_by('id').values('id', 'x', 'y', 'color'))
        return JsonResponse({"status": "success", "results": results, "all_points": all_current_points})

    except BoardGame.DoesNotExist:
        return JsonResponse({"error": "Board not found or permission denied."}, status=404)
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON data for pending changes."}, status=400)
    except ValidationError as ve:
        return JsonResponse({"error": ", ".join(ve.messages)}, status=400)
    except Exception as e:
        return JsonResponse({"error": f"An unexpected error occurred: {str(e)}"}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def update_board_name(request, board_id):
    try:
        data = json.loads(request.body)
        board = get_object_or_404(BoardGame, id=board_id, user=request.user)
        new_name = data.get('name')
        if not new_name or len(new_name.strip()) == 0:
             return JsonResponse({'status': 'error', 'message': 'Name cannot be empty.'}, status=400)
        if len(new_name) > 100:
             return JsonResponse({'status': 'error', 'message': 'Name too long (max 100 chars).'}, status=400)

        board.name = new_name.strip()
        board.save(update_fields=['name'])
        return JsonResponse({'status': 'success', 'name': board.name})
    except BoardGame.DoesNotExist:
        return JsonResponse({"error": "Board not found or permission denied."}, status=404)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


@csrf_exempt
@login_required
@require_http_methods(["POST"])
def update_board_dimensions(request, board_id):
    try:
        data = json.loads(request.body)
        board = get_object_or_404(BoardGame, id=board_id, user=request.user)

        new_cols = data.get('cols')
        new_rows = data.get('rows')

        if not (isinstance(new_cols, int) and 1 <= new_cols <= 12):
             return JsonResponse({'status': 'error', 'message': 'Cols must be an integer between 1 and 12.'}, status=400)
        if not (isinstance(new_rows, int) and 1 <= new_rows <= 12):
             return JsonResponse({'status': 'error', 'message': 'Rows must be an integer between 1 and 12.'}, status=400)

        board.cols = new_cols
        board.rows = new_rows
        board.save(update_fields=['cols', 'rows'])

        remaining_points = list(board.points.all().values('id', 'x', 'y', 'color'))

        return JsonResponse({
            'status': 'success',
            'cols': board.cols,
            'rows': board.rows,
            'points': remaining_points
        })
    except BoardGame.DoesNotExist:
        return JsonResponse({"error": "Board not found or permission denied."}, status=404)
    except ValidationError as ve:
         return JsonResponse({'status': 'error', 'message': ", ".join(ve.messages)}, status=400)
    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)

@csrf_exempt
@login_required
@require_http_methods(["DELETE"])
def delete_board_api(request, board_id):
    try:
        board = get_object_or_404(BoardGame, id=board_id, user=request.user)
        board_name = board.name
        board.delete() 

        redirect_url = reverse('gallery:route_list')

        return JsonResponse({'status': 'success', 'message': f'Board "{board_name}" deleted successfully.', 'redirect_url': redirect_url})
    except BoardGame.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': 'Board not found or permission denied.'}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)


@login_required
@require_http_methods(["GET"])
def api_my_boards(request):
    boards = BoardGame.objects.filter(user=request.user).select_related('background', 'user').order_by('-id')
    boards_data = []
    for board in boards:
        boards_data.append({
            'id': board.id,
            'name': board.name,
            'user_id': board.user.id,
            'creator_username': board.user.username,
            'background_image_url': board.background.image.url if board.background and board.background.image else None,
            'rows': board.rows,
            'cols': board.cols,
            'view_url': reverse('gallery:view_route', args=[board.id]),
            'delete_url': reverse('gallery:delete_board_api', args=[board.id])
        })
    return JsonResponse(boards_data, safe=False)

@login_required
@require_http_methods(["GET"])
def api_playable_boards(request):
    boards = BoardGame.objects.all().select_related('background', 'user').order_by('-id')
    boards_data = []
    for board in boards:
        boards_data.append({
            'id': board.id,
            'name': board.name,
            'user_id': board.user.id,
            'creator_username': board.user.username,
            'background_image_url': board.background.image.url if board.background and board.background.image else None,
            'rows': board.rows,
            'cols': board.cols,
            'view_url': reverse('gallery:play_game', args=[board.id]),
        })
    return JsonResponse(boards_data, safe=False)

@login_required
@require_http_methods(["GET"])
def api_background_images(request):
    backgrounds = BackgroundImage.objects.all().order_by('name')
    backgrounds_data = []
    for bg in backgrounds:
        backgrounds_data.append({
            'id': bg.id,
            'name': bg.name,
            'image_url': bg.image.url if bg.image else None,
        })
    return JsonResponse(backgrounds_data, safe=False)

@csrf_exempt
@login_required
@require_http_methods(["POST"])
def api_create_board(request):
    try:
        data = json.loads(request.body)
        name = data.get('name')
        rows = int(data.get('rows', 6))
        cols = int(data.get('cols', 6))
        background_id = data.get('background_id')

        if not name or not name.strip():
            return JsonResponse({'error': 'Board name cannot be empty.'}, status=400)
        if len(name) > 100:
            return JsonResponse({'error': 'Board name is too long (max 100 characters).'}, status=400)
        if not (1 <= rows <= 12):
            return JsonResponse({'error': 'Rows must be an integer between 1 and 12.'}, status=400)
        if not (1 <= cols <= 12):
            return JsonResponse({'error': 'Cols must be an integer between 1 and 12.'}, status=400)
        if not background_id:
            return JsonResponse({'error': 'Background image is required.'}, status=400)

        background = get_object_or_404(BackgroundImage, id=background_id)

        board = BoardGame.objects.create(
            user=request.user,
            background=background,
            name=name.strip(),
            rows=rows,
            cols=cols,
            auto_save_enabled=False
        )

        return JsonResponse({
            'id': board.id,
            'name': board.name,
            'user_id': board.user.id,
            'creator_username': board.user.username,
            'background_image_url': board.background.image.url if board.background and board.background.image else None,
            'rows': board.rows,
            'cols': board.cols,
            'view_url': reverse('gallery:view_route', args=[board.id]),
            'delete_url': reverse('gallery:delete_board_api', args=[board.id])
        }, status=201)

    except json.JSONDecodeError:
        return JsonResponse({'error': 'Invalid JSON data.'}, status=400)
    except BackgroundImage.DoesNotExist:
        return JsonResponse({'error': 'Selected background image not found.'}, status=404)
    except ValueError:
        return JsonResponse({'error': 'Invalid rows, cols, or background_id format.'}, status=400)
    except ValidationError as ve:
        return JsonResponse({"error": ", ".join(ve.messages)}, status=400)
    except Exception as e:
        return JsonResponse({'error': f'An unexpected error occurred: {str(e)}'}, status=500)


# Game views
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework import status
from .models import GamePlaySession, Path # Point, BoardGame already imported
from .serializers import GamePlaySessionSerializer, PathSerializer, PointSerializer # BoardSerializer not used here directly

@login_required
def play_game_view(request, board_id):
    board_game = get_object_or_404(BoardGame, pk=board_id)
    # Pass CSRF token to the template for client-side JS
    # The 'csrf_token' context variable is automatically available if using Django's CSRF middleware
    # and {% csrf_token %} in forms. For JS, it's often fetched from a cookie or a data attribute.
    # Here, explicitly adding it to the context for clarity, to be used in a data attribute.
    return render(request, 'gallery/play_game.html', {
        'board_id': board_id,
        'board_name': board_game.name,
        'csrf_token': request.META.get('CSRF_COOKIE') # Or use django.middleware.csrf.get_token(request)
    })

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_board_data_api(request, board_id):
    board = get_object_or_404(BoardGame, pk=board_id)
    points_data = PointSerializer(board.points.all(), many=True).data
    frontend_points = [{
        "id": p_data["id"], "x": p_data["x"], "y": p_data["y"], "color": p_data["color"]
    } for p_data in points_data]

    data_for_frontend = {
        'route': {
            'id': board.id, 'name': board.name, 'rows': board.rows, 'cols': board.cols,
            'auto_save_enabled': board.auto_save_enabled
        },
        'points': frontend_points
    }
    return Response(data_for_frontend)

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def get_or_create_game_session(request, board_id):
    board_game = get_object_or_404(BoardGame, pk=board_id)
    session, created = GamePlaySession.objects.get_or_create(
        player=request.user,
        board_game=board_game
    )
    serializer = GamePlaySessionSerializer(session, context={'request': request})
    return Response(serializer.data)

@api_view(['POST'])
@permission_classes([IsAuthenticated])
@transaction.atomic
def save_all_paths_api(request, session_id):
    session = get_object_or_404(GamePlaySession, pk=session_id)
    if session.player != request.user:
        return Response({'error': 'You do not own this game session.'}, status=status.HTTP_403_FORBIDDEN)

    paths_data_from_request = request.data.get('paths', [])
    if not isinstance(paths_data_from_request, list):
        return Response({'error': "Invalid data format. Expected a list of paths."}, status=status.HTTP_400_BAD_REQUEST)

    session.paths.all().delete() # Clear existing paths for this session

    saved_path_instances_for_check = []
    errors = []

    for path_data_item in paths_data_from_request:
        path_data_item['game_play_session'] = session.id # Ensure session ID is part of data for serializer
        serializer = PathSerializer(data=path_data_item, context={'request': request, 'view': request.parser_context['view']}) # Pass context
        if serializer.is_valid():
            try:
                path_instance = serializer.save() # This will call Path.save() which calls full_clean()
                saved_path_instances_for_check.append(path_instance)
            except ValidationError as e: # Django's ValidationError
                errors.append({path_data_item.get('color', 'unknown_color'): e.message_dict if hasattr(e, 'message_dict') else list(e)})
            except Exception as e: # Other unexpected errors
                errors.append({path_data_item.get('color', 'unknown_color'): f"Unexpected error: {str(e)}"})
        else:
            errors.append({path_data_item.get('color', 'unknown_color'): serializer.errors})

    if errors:
        transaction.set_rollback(True) # Rollback transaction due to errors
        return Response({'errors': errors, 'message': 'Some paths could not be saved due to validation errors.'}, status=status.HTTP_400_BAD_REQUEST)

    # Server-side validation of "solved" state based on saved paths
    board = session.board_game
    is_currently_solved = False

    # 1. All required colors have paths
    required_colors = set(Point.objects.filter(route=board).values_list('color', flat=True).distinct())
    drawn_colors = set(p.color for p in saved_path_instances_for_check)

    if required_colors == drawn_colors:
        # 2. No paths overlap (implicitly handled by unique cell check below if all cells are covered)
        # 3. All cells on the grid are covered by paths
        all_path_coords_flat = []
        valid_paths_for_solve_check = True
        for p_instance in saved_path_instances_for_check:
            # Path.clean() already validated endpoints and contiguity.
            # Path.clean() also validates path coordinates are within board bounds.
            # Path.clean() also validates self-intersection for each path.
            for coord in p_instance.path_data: # path_data is a list of dicts {'x': val, 'y': val}
                all_path_coords_flat.append((coord['x'], coord['y']))
        
        if valid_paths_for_solve_check:
            # Check for overlaps between different paths and if all cells are covered
            if len(all_path_coords_flat) == len(set(all_path_coords_flat)): # No overlaps between paths
                total_grid_cells = board.rows * board.cols
                if len(set(all_path_coords_flat)) == total_grid_cells: # All cells covered
                    is_currently_solved = True
    
    session.is_solved = is_currently_solved
    session.save(update_fields=['last_updated', 'is_solved']) # last_updated is auto_now, is_solved updated here.

    return Response({
        'message': 'Paths saved successfully.',
        'paths_count': len(saved_path_instances_for_check),
        'is_solved': is_currently_solved # Return server's calculation
    }, status=status.HTTP_200_OK)