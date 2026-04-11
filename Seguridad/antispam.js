const { EmbedBuilder, Events, PermissionFlagsBits } = require('discord.js');

// Configuración de umbral (Threshold)
const JOIN_LIMIT = 5; // Usuarios por cada 5 segundos
const TIME_WINDOW = 5000; // 5 segundos
let recentJoins = [];

module.exports = {
    name: Events.GuildMemberAdd,
    async execute(member) {
        const canalSecurityId = '1492339602420273241';
        const rolePingId = '1492340791098740777';
        const canalSecurity = member.guild.channels.cache.get(canalSecurityId);
        
        const ahora = Date.now();
        recentJoins.push(ahora);

        // Limpiar registros viejos del array
        recentJoins = recentJoins.filter(time => ahora - time < TIME_WINDOW);

        if (!canalSecurity) return;

        // --- 🟢 NIVEL 1: INTENTO MÍNIMO (Logs normales) ---
        if (recentJoins.length >= 3 && recentJoins.length < 5) {
            const embedBajo = new EmbedBuilder()
                .setColor('#ffff00')
                .setTitle('⚠️ Actividad Sospechosa Detectada')
                .setDescription(`Se detectó un flujo inusual de ingresos (Nivel Bajo).`)
                .addFields({ name: 'Origen Detectado', value: 'Discord API Gateway' }) // No existe acceso a IP por API de Bot
                .setTimestamp();

            await canalSecurity.send({ embeds: [embedBajo] });
        }

        // --- 🟠 NIVEL 2: NOTABLE (Ping a Rango) ---
        else if (recentJoins.length >= 5 && recentJoins.length < 10) {
            const embedMedio = new EmbedBuilder()
                .setColor('#ff8c00')
                .setTitle('🟠 ALERTA DE SEGURIDAD: FLUJO NOTABLE')
                .setDescription(`Posible intento de Flood/Raid en proceso. Se ha notificado a Seguridad.`)
                .setFooter({ text: 'Sistema Anti-Raid Anda RP' })
                .setTimestamp();

            await canalSecurity.send({ 
                content: `⚠️ <@&${rolePingId}> ¡Revisen ingresos recientes!`,
                embeds: [embedMedio] 
            });
        }

        // --- 🔴 NIVEL 3: CRÍTICO (Ping Everyone + Cierre de Seguridad) ---
        else if (recentJoins.length >= 10) {
            const embedCritico = new EmbedBuilder()
                .setColor('#ff0000')
                .setTitle('🚨 ALERTA CRÍTICA: ATAQUE DETECTADO')
                .setDescription(`El servidor está bajo un flujo masivo de ingresos. Se recomienda pausar invitaciones.`)
                .addFields({ name: 'Estado', value: 'BLOQUEO SUGERIDO', inline: true })
                .setTimestamp();

            await canalSecurity.send({ 
                content: `@everyone 🚨 **SISTEMA BAJO ATAQUE DE INGRESO MASIVO** 🚨`,
                embeds: [embedCritico] 
            });

            // Acción opcional: Intentar pausar invitaciones si el bot tiene permisos
            if (member.guild.members.me.permissions.has(PermissionFlagsBits.ManageGuild)) {
                // Aquí podrías implementar una función para cambiar el nivel de verificación del server
                await member.guild.setVerificationLevel(4).catch(e => console.log("No pude subir la seguridad"));
            }
        }
    }
};