/**
 * COMANDO DE PURGA PROFESIONAL (!) - ANDA RP
 */

module.exports = {
    name: 'purge',
    description: 'Elimina mensajes, incluyendo los mayores a 14 días.',

    rolesPermitidos: [
        '1482153188856434828', // [5] Equipo de Compras y Similares
        '1476768019496829033', // [6] Supervision Avanzada
        '1476768122915782676', // [7] Manager
        '1476768405037125885', // [8] Community Manager
        '1476768951034970253'  // [9] Fundacion
    ],

    async execute(message, args) {
        const tieneRol = message.member.roles.cache.some(role => this.rolesPermitidos.includes(role.id));
        if (!tieneRol) return message.reply('❌ **Error:** No tienes rango suficiente.');

        const cantidad = parseInt(args[0]);
        if (isNaN(cantidad) || cantidad < 1 || cantidad > 100) {
            return message.reply('📖 **Uso:** `!purge [1-100]`');
        }

        // Borramos el mensaje del comando primero
        await message.delete().catch(() => {});

        try {
            // 1. Intentamos el borrado rápido (mensajes nuevos)
            const deleted = await message.channel.bulkDelete(cantidad, true);
            
            // 2. Si faltaron mensajes por borrar (son los viejos > 14 días)
            if (deleted.size < cantidad) {
                const restantes = cantidad - deleted.size;
                const mensajesViejos = await message.channel.messages.fetch({ limit: restantes });
                
                // Borrado manual uno por uno
                for (const msg of mensajesViejos.values()) {
                    await msg.delete().catch(() => {});
                }
            }

            const aviso = await message.channel.send(`🗑️ **Limpieza:** Se eliminaron **${cantidad}** mensajes (incluyendo antiguos).`);
            setTimeout(() => aviso.delete().catch(() => {}), 5000);

        } catch (error) {
            console.error(error);
            message.channel.send('❌ Ocurrió un error al intentar purgar los mensajes.');
        }
    }
};