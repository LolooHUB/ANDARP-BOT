const { EmbedBuilder } = require('discord.js');
const ms = require('ms');
const { db } = require('../Comandos/Automatizaciones/firebase');

/**
 * SISTEMA DE DESPACHOS PROFESIONAL
 * Incluye: Persistencia en Firebase, Auto-Remoción, Desconexión de Voz Forzada y Logs.
 */

module.exports = {
    name: 'despacho',
    description: 'Gestiona los roles de despacho con persistencia y desconexión de voz.',
    
    async execute(message, args) {
        const prefix = '!';
        const fullContent = message.content.trim();
        const commandName = fullContent.slice(prefix.length).split(/ +/)[0].toLowerCase();

        // --- 1. CONFIGURACIÓN DE ACCESOS ---
        const config = {
            '824811313989419018': '1490394005094006876', // Ejecutor A
            '1315779036076707902': '1490394004569722890'  // Ejecutor B
        };

        const ejecutorId = message.author.id;
        const targetMember = message.mentions.members.first();
        const roleId = config[ejecutorId];

        // --- 2. VALIDACIONES DE SEGURIDAD ---
        if (!config[ejecutorId]) {
            return message.reply('❌ **Error de Permisos:** No estás autorizado para gestionar este despacho.');
        }

        if (!targetMember) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('📖 Guía de Comandos: Despacho')
                .setDescription('Usa los comandos para gestionar accesos temporales.')
                .addFields(
                    { name: '✅ Asignar', value: `\`${prefix}despacho @usuario [tiempo]\` (Ej: 30m, 1h, 2d)`, inline: true },
                    { name: '❌ Cancelar', value: `\`${prefix}cdespacho @usuario\``, inline: true }
                );
            return message.reply({ embeds: [helpEmbed] });
        }

        const role = message.guild.roles.cache.get(roleId);
        if (!role) return message.reply('❌ **Error Crítico:** El rol configurado no existe en este servidor.');

        // --- 3. LÓGICA: !cdespacho (CANCELACIÓN MANUAL) ---
        if (commandName === 'cdespacho') {
            try {
                // Forzamos el fetch para tener el estado de voz actualizado
                const memberFetch = await message.guild.members.fetch(targetMember.id).catch(() => null);
                
                if (memberFetch) {
                    // Quitar Rol
                    if (memberFetch.roles.cache.has(roleId)) {
                        await memberFetch.roles.remove(role, 'Despacho cancelado por superior.');
                    }

                    // DESCONEXIÓN DE VOZ (FIX)
                    // Importante: El bot necesita permiso de "MOVE_MEMBERS"
                    if (memberFetch.voice.channel) {
                        await memberFetch.voice.setChannel(null, 'Despacho cancelado manualmente');
                    }
                }

                // Limpiar persistencia en Firebase
                await db.collection('despachos_activos').doc(targetMember.id).delete();

                const cancelEmbed = new EmbedBuilder()
                    .setColor('#e74c3c')
                    .setTitle('🔒 ACCESO REVOCADO')
                    .setThumbnail(message.author.displayAvatarURL())
                    .setDescription(`Se ha retirado el acceso a **${role.name}** para ${targetMember}.`)
                    .addFields({ name: 'Responsable', value: `<@${ejecutorId}>`, inline: true })
                    .setTimestamp();

                return message.channel.send({ embeds: [cancelEmbed] });

            } catch (error) {
                console.error("Error en cdespacho:", error);
                return message.reply('❌ Error al intentar revocar el acceso.');
            }
        }

        // --- 4. LÓGICA: !despacho (ASIGNACIÓN TEMPORAL) ---
        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h';
            const tiempoMs = ms(tiempoRaw);

            if (!tiempoMs) return message.reply('❌ **Formato Inválido:** Usa `10m`, `1h`, `2h`, etc.');

            const expiracionUnix = Date.now() + tiempoMs;

            try {
                // Asignar Rol
                await targetMember.roles.add(role, `Despacho asignado por ${message.author.tag}`);

                // REGISTRO EN FIREBASE PARA PERSISTENCIA
                await db.collection('despachos_activos').doc(targetMember.id).set({
                    guildId: message.guild.id,
                    roleId: roleId,
                    expiracion: expiracionUnix,
                    asignadoPor: ejecutorId,
                    canalLog: message.channel.id
                });

                const successEmbed = new EmbedBuilder()
                    .setColor('#2ecc71')
                    .setTitle('📋 DESPACHO ASIGNADO')
                    .setDescription(`El usuario ${targetMember} ahora tiene acceso a **${role.name}**.`)
                    .addFields(
                        { name: '⏳ Tiempo', value: `\`${tiempoRaw}\``, inline: true },
                        { name: '👤 Autoriza', value: `<@${ejecutorId}>`, inline: true },
                        { name: '💾 Persistencia', value: 'Activada (Base de Datos)', inline: true }
                    )
                    .setFooter({ text: 'La expulsión de voz y retiro de rol será automática.' })
                    .setTimestamp();

                await message.channel.send({ embeds: [successEmbed] });

                // Temporizador en memoria (para ejecución inmediata si no hay reinicio)
                setTimeout(() => {
                    this.finalizarDespacho(message.guild, targetMember.id, roleId);
                }, tiempoMs);

            } catch (error) {
                console.error("Error en despacho:", error);
                message.reply('❌ Error al asignar el despacho. Verifica los permisos del Bot.');
            }
        }
    },

    /**
     * FUNCIÓN DE CIERRE (Usada por el timer y por el check de persistencia al iniciar)
     */
    async finalizarDespacho(guild, userId, roleId) {
        try {
            // Buscamos al miembro de nuevo para evitar datos obsoletos
            const member = await guild.members.fetch(userId).catch(() => null);
            
            if (member) {
                // 1. Quitar el Rol
                if (member.roles.cache.has(roleId)) {
                    await member.roles.remove(roleId, 'Tiempo de despacho agotado.');
                }

                // 2. DESCONEXIÓN DE VOZ FORZADA
                // Al poner setChannel(null) expulsamos al usuario del canal de voz.
                if (member.voice.channel) {
                    await member.voice.setChannel(null, 'Fin del tiempo de despacho.');
                }
                
                console.log(`[Persistencia] Despacho finalizado con éxito para ${member.user.tag}`);
            }

            // 3. Borrar de la base de datos
            await db.collection('despachos_activos').doc(userId).delete();
            
        } catch (e) {
            console.error(`[Persistencia] Fallo al limpiar despacho de ${userId}:`, e);
        }
    }
};