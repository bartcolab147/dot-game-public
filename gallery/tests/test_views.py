from django.test import TestCase
from django.contrib.auth.models import User
from django.urls import reverse
from gallery.models import BackgroundImage, BoardGame
from django.contrib.auth import get_user_model
from django.contrib.auth.views import LogoutView
from django.contrib.auth import SESSION_KEY

class ViewTests(TestCase):

    def setUp(self):
        self.user = User.objects.create_user(username='testuser', password='pass')
        self.bg = BackgroundImage.objects.create(name='BG', image='backgrounds/test.jpg', width=800, height=600)

    def test_redirect_if_not_logged_in(self):
        response = self.client.get(reverse('gallery:route_list'))
        self.assertRedirects(response, '/users/login/?next=/gallery/')

    def test_logged_in_can_create_route(self):
        self.client.login(username='testuser', password='pass')
        response = self.client.post(reverse('gallery:route_list'), {'background_id': self.bg.id})
        self.assertEqual(response.status_code, 302)  # redirect after POST
        self.assertEqual(BoardGame.objects.count(), 1)
        self.assertEqual(BoardGame.objects.first().user, self.user)

    def test_login_view_loads(self):
        response = self.client.get(reverse('users:login'))
        self.assertEqual(response.status_code, 200)

    def test_user_can_logout(self):
        self.client.login(username='testuser', password='pass')
        response = self.client.get(reverse('users:logout'))
        self.assertRedirects(response, '/')  # lub inna strona, jeśli masz redirect po logout

    def test_route_list_logged_in(self):
        self.client.login(username='testuser', password='pass')
        response = self.client.get(reverse('gallery:route_list'))
        self.assertEqual(response.status_code, 200)
