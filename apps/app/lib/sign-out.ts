"use client";

import { signOut } from "@crm/auth/client";
import { toast } from "sonner";

export async function signOutAndRedirect() {
	const { error } = await signOut();

	if (error) {
		toast.error(error.message ?? "No se pudo cerrar la sesión.");
		return;
	}

	window.location.assign("/sign-in");
}
