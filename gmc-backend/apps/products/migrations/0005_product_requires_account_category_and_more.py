import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0004_wishlist'),
    ]

    operations = [
        migrations.AddField(
            model_name='product',
            name='requires_account',
            field=models.BooleanField(default=False),
        ),
        migrations.CreateModel(
            name='Category',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('name', models.CharField(max_length=100)),
                ('slug', models.SlugField(unique=True)),
                ('icon', models.CharField(blank=True, max_length=10)),
                ('image', models.ImageField(blank=True, null=True, upload_to='categories/')),
                ('color', models.CharField(blank=True, max_length=7)),
                ('description', models.TextField(blank=True)),
                ('is_active', models.BooleanField(default=True)),
                ('order', models.IntegerField(default=0)),
                ('requires_account', models.BooleanField(default=False)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('parent', models.ForeignKey(
                    blank=True, null=True,
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='children', to='products.category'
                )),
            ],
            options={
                'verbose_name_plural': 'categories',
                'ordering': ['order', 'name'],
            },
        ),
        # Drop old CharField category column first, then add FK
        migrations.RemoveField(
            model_name='product',
            name='category',
        ),
        migrations.AddField(
            model_name='product',
            name='category',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='products', to='products.category',
            ),
        ),
    ]
