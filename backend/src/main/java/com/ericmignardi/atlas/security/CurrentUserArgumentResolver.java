package com.ericmignardi.atlas.security;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import lombok.RequiredArgsConstructor;

/**
 * Turns {@code @CurrentUser UserPrincipal} in a controller signature into the
 * caller. Both halves of the check matter: the annotation says the parameter is
 * meant for this, the type says it can hold the result, and requiring both
 * keeps the resolver from quietly claiming some other {@code UserPrincipal}
 * parameter later.
 *
 * @see com.ericmignardi.atlas.config.WebConfig
 */
@Component
@RequiredArgsConstructor
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

	private final CurrentUserResolver currentUser;

	@Override
	public boolean supportsParameter(MethodParameter parameter) {
		return parameter.hasParameterAnnotation(CurrentUser.class)
				&& UserPrincipal.class.isAssignableFrom(parameter.getParameterType());
	}

	@Override
	public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
			NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {

		return currentUser.require();
	}
}
