package com.ericmignardi.atlas.security;

import java.lang.annotation.Documented;
import java.lang.annotation.ElementType;
import java.lang.annotation.Retention;
import java.lang.annotation.RetentionPolicy;
import java.lang.annotation.Target;

/**
 * Injects the authenticated caller into a controller method:
 *
 * <pre>{@code
 * public List<ProjectResponse> list(@CurrentUser UserPrincipal user) { ... }
 * }</pre>
 *
 * <p>One annotation rather than each controller reaching into
 * {@code SecurityContextHolder} by hand — the parameter is visible in the method
 * signature, which makes "does this endpoint know who is calling" answerable by
 * reading it, and it is trivially stubbed in a test.
 *
 * @see CurrentUserArgumentResolver
 */
@Documented
@Target(ElementType.PARAMETER)
@Retention(RetentionPolicy.RUNTIME)
public @interface CurrentUser {
}
