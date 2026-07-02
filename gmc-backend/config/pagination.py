from rest_framework.pagination import PageNumberPagination


class DefaultPagination(PageNumberPagination):
    """Standard pagination for all list endpoints. Honors a client-supplied
    ?page_size= (capped) so admin pages can request larger pages than the
    public-facing default."""
    page_size = 12
    page_size_query_param = 'page_size'
    max_page_size = 100
