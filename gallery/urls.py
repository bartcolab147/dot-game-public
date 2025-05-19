# gallery/urls.py
from django.urls import path
from . import views

# If you are also using DRF for other things, you can keep these imports
# from django.urls import path, include
# from rest_framework.routers import DefaultRouter
# from .views import (
#     RouteListCreateAPIView, # Assuming this is BoardGame related
#     RouteRetrieveUpdateDestroyAPIView, # Assuming this is BoardGame related
#     PointListCreateAPIView,
#     PointRetrieveUpdateDestroyAPIView
# )

app_name = 'gallery'

urlpatterns = [
    # Main page view
    path('', views.route_list, name='route_list'),

    # View for a specific route (board game) - used for playing/editing
    path('route/<int:route_id>/', views.view_route, name='view_route'),

    # --- API endpoints specifically for route_list.html frontend ---
    path('api/my-boards/', views.api_my_boards, name='api_my_boards'),
    path('api/playable-boards/', views.api_playable_boards, name='api_playable_boards'),
    path('api/backgrounds/', views.api_background_images, name='api_background_images'),
    path('api/boards/create/', views.api_create_board, name='api_create_board'), # For creating boards
    # API for deleting a specific board (used by "My Boards" delete button)
    path('route/<int:board_id>/delete/', views.delete_board_api, name='delete_board_api'),


    path('api/point/<int:point_id>/delete/', views.delete_point_api, name='delete_point_api'), 

    path("points/update/<int:route_id>/<int:point_id>/", views.update_point, name="update_point"), 
    path('points/add/<int:route_id>/', views.add_points, name='add_points'), 

    path('route/<int:board_id>/update-name/', views.update_board_name, name='update_board_name'),
    path('route/<int:board_id>/update-dimensions/', views.update_board_dimensions, name='update_board_dimensions'),
    
    path('api/board/<int:board_id>/toggle-autosave/', views.toggle_board_autosave, name='toggle_board_autosave'), 
    path('api/board/<int:route_id>/save-pending-changes/', views.save_pending_changes, name='save_pending_changes'), 


    # Gameplay URLs
    path('play/<int:board_id>/', views.play_game_view, name='play_game'),
    
    path('api/board/<int:board_id>/data/', views.get_board_data_api, name='get_board_data_api'),
    path('api/game/board/<int:board_id>/session/', views.get_or_create_game_session, name='get_or_create_game_session'),
    
    # New endpoint for saving all paths
    path('api/game/session/<int:session_id>/save_all_paths/', views.save_all_paths_api, name='save_all_paths_api'),

]