package com.ericmignardi.atlas.environment;

import java.util.UUID;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import com.ericmignardi.atlas.common.error.ConflictException;
import com.ericmignardi.atlas.common.error.NotFoundException;

import lombok.RequiredArgsConstructor;

/** FR-3.7 – FR-3.13. */
@Service
@RequiredArgsConstructor
public class EnvironmentPairingService {

	private final EnvironmentRepository environments;

	public record Pairing(Environment environment, Environment partner) {
	}

	@Transactional
	public Pairing pair(UUID userId, UUID environmentId, UUID targetId) {
		Environment a = require(userId, environmentId);
		Environment b = require(userId, targetId);

		// FR-3.10 is checked first: an environment trivially shares its own
		// project and its own type, so both later guards would let it past.
		if (a.getId().equals(b.getId())) {
			throw new ConflictException("PAIR_SELF", "An environment cannot be paired with itself.");
		}
		if (!a.getProject().getId().equals(b.getProject().getId())) {
			throw new ConflictException("PAIR_DIFFERENT_PROJECT",
					"Environments must belong to the same project.");
		}
		if (a.getType() != b.getType()) {
			throw new ConflictException("PAIR_DIFFERENT_TYPE",
					"Environments must share the same type.");
		}

		// FR-3.11, and not a style preference: paired_with_id is UNIQUE, so
		// assigning before releasing puts two rows on the same value. Postgres
		// checks that per statement, and Hibernate is free to order the updates
		// within a flush however it likes — hence the explicit flush between.
		releasePartner(a);
		releasePartner(b);
		environments.flush();

		a.setPairedWith(b);
		b.setPairedWith(a);
		a.setPairedBy(b);
		b.setPairedBy(a);
		environments.save(a);
		environments.save(b);

		return new Pairing(a, b);
	}

	@Transactional
	public Pairing unpair(UUID userId, UUID environmentId) {
		Environment environment = require(userId, environmentId);
		Environment partner = partnerOf(environment);

		releasePartner(environment);

		return new Pairing(environment, partner);
	}

	/** The reverse lookup is the safety net for a row written one-sidedly. */
	public Environment partnerOf(Environment environment) {
		if (environment.getPairedWith() != null) {
			return environment.getPairedWith();
		}
		if (environment.getId() == null) {
			return null;
		}
		return environments.findByPairedWithId(environment.getId()).orElse(null);
	}

	/**
	 * FR-3.11. Both directions are cleared: a partner left pointing back reads as
	 * paired from one end and unpaired from the other, and then blocks the next
	 * pairing with a UNIQUE violation.
	 *
	 * <p>{@code pairedBy} writes no column, but it is still an object reference,
	 * and one left pointing at a row about to be deleted makes Hibernate refuse
	 * the flush. The claimant is looked up before anything is nulled, so the
	 * query runs against the state on disk.
	 */
	void releasePartner(Environment environment) {
		Environment partner = environment.getPairedWith();
		Environment claimant = environment.getId() == null
				? null
				: environments.findByPairedWithId(environment.getId()).orElse(null);

		release(environment);
		if (partner != null) {
			release(partner);
		}
		if (claimant != null) {
			release(claimant);
		}
	}

	private static void release(Environment environment) {
		environment.setPairedWith(null);
		environment.setPairedBy(null);
	}

	private Environment require(UUID userId, UUID id) {
		return environments.findByIdAndUserId(id, userId)
				.orElseThrow(() -> NotFoundException.of("Environment", id));
	}
}
