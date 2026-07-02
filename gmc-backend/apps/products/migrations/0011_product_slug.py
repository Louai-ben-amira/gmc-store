from django.db import migrations, models
from django.utils.text import slugify


def populate_slugs(apps, schema_editor):
    Product = apps.get_model('products', 'Product')
    for p in Product.objects.all():
        base = slugify(p.name) or f'product-{p.pk}'
        slug = base
        n = 1
        while Product.objects.filter(slug=slug).exclude(pk=p.pk).exists():
            slug = f'{base}-{n}'
            n += 1
        p.slug = slug
        p.save(update_fields=['slug'])


class Migration(migrations.Migration):

    dependencies = [
        ('products', '0010_code_products_co_product_b707b6_idx'),
    ]

    operations = [
        # 1. Add nullable slug column
        migrations.AddField(
            model_name='product',
            name='slug',
            field=models.SlugField(max_length=220, blank=True, default='', db_index=False),
            preserve_default=False,
        ),
        # 2. Fill slugs from existing names
        migrations.RunPython(populate_slugs, migrations.RunPython.noop),
        # 3. Make unique + non-null
        # db_index=False: unique=True already creates the index Postgres needs;
        # leaving db_index at its SlugField-default True makes Django emit a
        # second same-named "_like" pattern index for the same column, which
        # collides with the one unique=True just created and fails every run.
        migrations.AlterField(
            model_name='product',
            name='slug',
            field=models.SlugField(max_length=220, unique=True, db_index=False, blank=True),
        ),
    ]
