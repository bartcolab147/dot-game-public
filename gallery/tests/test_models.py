import os
import shutil
from django.test import TestCase
from django.contrib.auth.models import User
from gallery.models import BackgroundImage, BoardGame, Point
from django.core.files.uploadedfile import SimpleUploadedFile
from django.conf import settings

class ModelTests(TestCase):

    def setUp(self):
        # Oryginalny plik testowy w folderze MEDIA/backgrounds
        self.original_image_path = os.path.join(settings.MEDIA_ROOT, 'backgrounds', 'test.jpg')

        # Folder, do którego skopiujemy plik testowy
        self.test_image_copy_path = os.path.join(settings.MEDIA_ROOT, 'backgrounds', 'test_copy.jpg')

        # Kopiujemy oryginalny plik do nowej lokalizacji
        shutil.copy(self.original_image_path, self.test_image_copy_path)

        # Tworzymy użytkownika
        self.user = User.objects.create_user(username='testuser', password='pass')

        # Tworzymy tło (background) z kopią pliku testowego
        self.background = BackgroundImage.objects.create(
            image='backgrounds/test_copy.jpg',
            name="Test Background"
        )

        # Tworzymy trasę
        self.route = BoardGame.objects.create(user=self.user, background=self.background, name="Test Route")

    def test_route_created_successfully(self):
        self.assertEqual(self.route.name, "Test Route")
        self.assertEqual(self.route.background.name, "Test Background")

    def test_create_point(self):
        point = Point.objects.create(route=self.route, x=50.0, y=50.0)
        self.assertEqual(point.route, self.route)
        self.assertEqual(point.x, 50.0)
        self.assertEqual(point.y, 50.0)

    def test_route_str(self):
        self.assertEqual(str(self.route), "Test Route (testuser)")

    def test_background_dimensions_set(self):
        self.assertIsNotNone(self.background.width)
        self.assertIsNotNone(self.background.height)

    def tearDown(self):
        if os.path.exists(self.test_image_copy_path):
            os.remove(self.test_image_copy_path)
