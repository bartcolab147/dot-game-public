from rest_framework.test import APITestCase, APIClient
from django.contrib.auth.models import User
from rest_framework_simplejwt.tokens import RefreshToken
from gallery.models import BackgroundImage, BoardGame, Point

class APIRouteTests(APITestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='pass')
        self.token = str(RefreshToken.for_user(self.user).access_token)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + self.token)

        self.bg = BackgroundImage.objects.create(name='BG', image='backgrounds/test.jpg', width=100, height=100)
        self.route = BoardGame.objects.create(user=self.user, background=self.bg, name='Route 1')

    def test_get_routes(self):
        response = self.client.get('/gallery/api/routes/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 1)

    def test_create_route(self):
        response = self.client.post('/gallery/api/routes/', {'name': 'New Route', 'background': self.bg.id})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(BoardGame.objects.count(), 2)

    def test_create_point(self):
        response = self.client.post(f'/gallery/api/routes/{self.route.id}/points/', {'x': 25.5, 'y': 30.2})
        self.assertEqual(response.status_code, 201)
        self.assertEqual(Point.objects.count(), 1)

    def test_unauthenticated_access(self):
        self.client.credentials()  # remove token
        response = self.client.get('/gallery/api/routes/')
        self.assertEqual(response.status_code, 401)

    def test_create_route_missing_fields(self):
        response = self.client.post('/gallery/api/routes/', {})  # brak wymaganych danych
        self.assertEqual(response.status_code, 400)
        self.assertIn('name', response.data)
        self.assertIn('background', response.data)

    def test_create_point_invalid_coordinates(self):
        # x > 100, y < 0 — poza zakresem
        data = {'x': 150.0, 'y': -10.0}
        response = self.client.post(f'/gallery/api/routes/{self.route.id}/points/', data)
        self.assertEqual(response.status_code, 400)
        self.assertIn('x', response.data)
        self.assertIn('y', response.data)

    def test_create_point_missing_coordinates(self):
        data = {}  # brak x i y
        response = self.client.post(f'/gallery/api/routes/{self.route.id}/points/', data)
        self.assertEqual(response.status_code, 400)

    def test_get_points_for_route(self):
        Point.objects.create(route=self.route, x=10, y=20)
        Point.objects.create(route=self.route, x=30, y=40)
        response = self.client.get(f'/gallery/api/routes/{self.route.id}/points/')
        self.assertEqual(response.status_code, 200)
        self.assertEqual(len(response.data), 2)
        self.assertEqual(response.data[0]['x'], 10.0)
        self.assertEqual(response.data[1]['y'], 40.0)

    def test_delete_point(self):
        point = Point.objects.create(route=self.route, x=10, y=20)
        response = self.client.delete(f'/gallery/api/routes/{self.route.id}/points/{point.id}/')
        self.assertEqual(response.status_code, 204)
        self.assertEqual(Point.objects.count(), 0)

    def test_json_format_for_routes(self):
        response = self.client.get('/gallery/api/routes/')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.data, list)
        self.assertIn('name', response.data[0])
        self.assertIn('id', response.data[0])
        self.assertIn('background', response.data[0])

class ForeignAccessTests(APITestCase):
    def setUp(self):
        self.owner = User.objects.create_user(username='owner', password='pass')
        self.other = User.objects.create_user(username='other', password='pass')
        self.bg = BackgroundImage.objects.create(name='BG', image='backgrounds/test.jpg', width=100, height=100)
        self.route = BoardGame.objects.create(user=self.owner, background=self.bg, name='Secret Route')

        self.token = str(RefreshToken.for_user(self.other).access_token)
        self.client = APIClient()
        self.client.credentials(HTTP_AUTHORIZATION='Bearer ' + self.token)

    def test_cannot_get_foreign_route(self):
        response = self.client.get(f'/gallery/api/routes/{self.route.id}/')
        self.assertEqual(response.status_code, 404)  # Nie 403 – bo queryset.filter(user=request.user)

    def test_cannot_delete_foreign_route(self):
        response = self.client.delete(f'/gallery/api/routes/{self.route.id}/')
        self.assertEqual(response.status_code, 404)

    def test_cannot_add_point_to_foreign_route(self):
        response = self.client.post(f'/gallery/api/routes/{self.route.id}/points/', {'x': 10, 'y': 10})
        self.assertEqual(response.status_code, 404)

    def test_cannot_delete_point_from_foreign_route(self):
        point = Point.objects.create(route=self.route, x=10, y=10)
        response = self.client.delete(f'/gallery/api/routes/{self.route.id}/points/{point.id}/')
        self.assertEqual(response.status_code, 404)

    def test_delete_nonexistent_point(self):
        response = self.client.delete(f'/gallery/api/routes/{self.route.id}/points/999/')
        self.assertEqual(response.status_code, 404)


