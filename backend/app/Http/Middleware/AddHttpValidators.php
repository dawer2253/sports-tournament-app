<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Walidator HTTP na trasach `/public/*` (ADR-0007): `ETag` liczony z treści
 * odpowiedzi, `Cache-Control` z `no-cache`, a zgodny `If-None-Match` daje
 * `304` z pustym ciałem.
 *
 * `ETag` z treści, nie ze stanu bazy, więc zmienia się wtedy i tylko wtedy,
 * gdy zmienia się odpowiedź — przeliczona tabela z tym samym wynikiem daje
 * ten sam walidator. Ceną jest to, że `304` nie oszczędza pracy serwera,
 * tylko pasmo (ADR-0007, „Konsekwencje").
 *
 * Tylko `200`. Wbudowane `cache.headers` Laravela nadałoby walidator także
 * `404`, a zgodny `If-None-Match` zamieniłby je potem w `304` — kontrakt
 * opisuje walidator wyłącznie przy treści turnieju.
 */
class AddHttpValidators
{
    public function handle(Request $request, Closure $next): Response
    {
        $response = $next($request);

        if (! $request->isMethodCacheable() || $response->getStatusCode() !== Response::HTTP_OK) {
            return $response;
        }

        $response->setEtag(hash('xxh128', (string) $response->getContent()));
        // Symfony dokłada do `no-cache` jeszcze `private` (odpowiedź bez
        // `public`), co kontrakt dopuszcza: wymaga obecności `no-cache`.
        $response->headers->addCacheControlDirective('no-cache');
        $response->isNotModified($request);

        return $response;
    }
}
