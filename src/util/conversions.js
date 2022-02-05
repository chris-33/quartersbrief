const conversions = {
	BWToMeters: bw => bw * 30,
	TorpDamageToActual: x => x * 0.36, // @reveng Torpedo damage needs to be multiplied by ~0.36 to get the actual alpha damage, but I can't see where this value comes from
}

export { conversions };