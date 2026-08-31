package com.ericmignardi.atlas.security;

import org.springframework.core.MethodParameter;
import org.springframework.stereotype.Component;
import org.springframework.web.bind.support.WebDataBinderFactory;
import org.springframework.web.context.request.NativeWebRequest;
import org.springframework.web.method.support.HandlerMethodArgumentResolver;
import org.springframework.web.method.support.ModelAndViewContainer;

import lombok.RequiredArgsConstructor;

/**
 * @see com.ericmignardi.atlas.config.WebConfig
 */
@Component
@RequiredArgsConstructor
public class CurrentUserArgumentResolver implements HandlerMethodArgumentResolver {

	private final CurrentUserResolver currentUser;

	@Override
	public boolean supportsParameter(MethodParameter parameter) {
		// Both halves matter: the annotation says the parameter is meant for
		// this, the type says it can hold the result.
		return parameter.hasParameterAnnotation(CurrentUser.class)
				&& UserPrincipal.class.isAssignableFrom(parameter.getParameterType());
	}

	@Override
	public Object resolveArgument(MethodParameter parameter, ModelAndViewContainer mavContainer,
			NativeWebRequest webRequest, WebDataBinderFactory binderFactory) {

		return currentUser.require();
	}
}
