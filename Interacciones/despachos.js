const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ComponentType } = require('discord.js');
const ms = require('ms');
const { sendTicketPanel } = require('../Automatizaciones/tickets');

/**
 * SISTEMA DE DESPACHOS PROFESIONAL - ANDA RP
 * Incluye: Persistencia, Sala de Espera, Elección Interactiva y Movimiento de Voz.
 */

module.exports = {
    name: 'despacho',
    description: 'Gestiona los roles de despacho con persistencia y sistema de sala de espera.',

    // --- CONFIGURACIÓN DE IDS (Sincronizado) ---
    config: {
        '824811313989419018': { 
            role: '1490394005094006876', 
            voice: '1491829800451444746', // ID del Canal de Voz Despacho A (Cámbialo si es distinto)
            nombre: 'Despacho A' 
        },
        '1315779036076707902': { 
            role: '1490394004569722890', 
            voice: '1491829800451444747', // ID del Canal de Voz Despacho B (Cámbialo si es distinto)
            nombre: 'Despacho B' 
        }
    },
    salaEsperaId: '1491829520779444314',

    async execute(message, args) {
        const prefix = '!';
        const fullContent = message.content.trim();
        const commandName = fullContent.slice(prefix.length).split(/ +/)[0].toLowerCase();

        const ejecutorId = message.author.id;
        const targetMember = message.mentions.members.first();

        if (!this.config[ejecutorId]) {
            return message.reply('❌ **Error de Permisos:** No estás autorizado.');
        }

        if (!targetMember) {
            const helpEmbed = new EmbedBuilder()
                .setColor('#f1c40f')
                .setTitle('📖 Guía de Comandos: Despacho')
                .addFields(
                    { name: '✅ Asignar', value: `\`${prefix}despacho @usuario [tiempo]\``, inline: true },
                    { name: '❌ Cancelar', value: `\`${prefix}cdespacho @usuario\``, inline: true }
                );
            return message.reply({ embeds: [helpEmbed] });
        }

        // LÓGICA: !cdespacho
        if (commandName === 'cdespacho') {
            await this.finalizarDespacho(message.guild, targetMember.id, this.config[ejecutorId].role);
            return message.reply(`✅ Acceso revocado y usuario desconectado.`);
        }

        // LÓGICA: !despacho
        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h';
            await this.asignarDespacho(message.guild, targetMember, ejecutorId, tiempoRaw, message.channel.id);
        }
    },

    // --- NUEVA LÓGICA: DETECTAR ENTRADA A SALA DE ESPERA ---
    async handleWaitingRoom(oldState, newState) {
        if (newState.channelId !== this.salaEsperaId) return;
        const member = newState.member;
        if (member.user.bot) return;

        const canalTexto = newState.guild.channels.cache.get(this.salaEsperaId);
        if (!canalTexto) return;

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🛎️ Control de Accesos')
            .setDescription(`Hola ${member}, ¿a qué despacho deseas dirigirte?\n\n1️⃣ **Despacho A**\n2️⃣ **Despacho B**\n\n*Escribe el número en este chat.*`);

        const msgPregunta = await canalTexto.send({ content: `${member}`, embeds: [welcomeEmbed] });

        // Colector para leer la respuesta (1 o 2)
        const filter = m => m.author.id === member.id && ['1', '2'].includes(m.content);
        const collector = canalTexto.createMessageCollector({ filter, time: 30000, max: 1 });

        collector.on('collect', async m => {
            const eleccion = m.content === '1' ? '824811313989419018' : '1315779036076707902';
            const dataDespacho = this.config[eleccion];
            const dueño = await newState.guild.members.fetch(eleccion).catch(() => null);

            if (!dueño) return m.reply('❌ El dueño del despacho no está en la ciudad.');

            // Botones para el dueño
            const row = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`apr_desp_${member.id}`).setLabel('Permitir Entrada').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`den_desp_${member.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
            );

            await m.reply(`⏳ Avisando a **${dueño.user.username}**... espera su respuesta.`);

            try {
                const promptDueño = await dueño.send({
                    content: `🔔 **Petición de Acceso:**\nEl ciudadano ${member.user.tag} está en la sala de espera y solicita entrar a tu despacho.`,
                    components: [row]
                });

                const iCollector = promptDueño.createMessageComponentCollector({ componentType: ComponentType.Button, time: 60000 });

                iCollector.on('collect', async i => {
                    if (i.customId.startsWith('apr_desp')) {
                        // 1. Asignar Despacho (1h por defecto)
                        await this.asignarDespacho(newState.guild, member, eleccion, '1h', canalTexto.id);
                        
                        // 2. Mover de canal de voz
                        if (member.voice.channel) {
                            await member.voice.setChannel(dataDespacho.voice).catch(() => {});
                        }

                        await i.update({ content: '✅ Has permitido el acceso. El usuario ha sido movido.', components: [] });
                        await canalTexto.send(`✅ **Acceso Concedido:** ${member} ha sido movido al ${dataDespacho.nombre}.`);
                    } else {
                        await i.update({ content: '❌ Has denegado el acceso.', components: [] });
                        await canalTexto.send(`❌ **Acceso Denegado:** El dueño del despacho ha rechazado la solicitud de ${member}.`);
                    }
                    iCollector.stop();
                });

            } catch (e) {
                m.reply(`❌ No pude contactar con el dueño (DMs cerrados o no respondió).`);
            }
        });
    },

    // --- FUNCIONES AUXILIARES REUTILIZABLES ---
    async asignarDespacho(guild, targetMember, ejecutorId, tiempoRaw, canalLogId) {
        const config = this.config[ejecutorId];
        const role = guild.roles.cache.get(config.role);
        const tiempoMs = ms(tiempoRaw);
        if (!tiempoMs || !role) return;

        const expiracionUnix = Date.now() + tiempoMs;

        try {
            await targetMember.roles.add(role);
            await db.collection('despachos_activos').doc(targetMember.id).set({
                guildId: guild.id,
                roleId: config.role,
                expiracion: expiracionUnix,
                asignadoPor: ejecutorId
            });

            const embed = new EmbedBuilder()
                .setColor('#2ecc71')
                .setTitle('📋 DESPACHO ASIGNADO')
                .setDescription(`${targetMember} tiene acceso a **${role.name}** por **${tiempoRaw}**.`)
                .setTimestamp();

            const canal = guild.channels.cache.get(canalLogId);
            if (canal) await canal.send({ embeds: [embed] });

            setTimeout(() => {
                this.finalizarDespacho(guild, targetMember.id, config.role);
            }, tiempoMs);
        } catch (e) { console.error(e); }
    },

    async finalizarDespacho(guild, userId, roleId) {
        try {
            const member = await guild.members.fetch(userId).catch(() => null);
            if (member) {
                if (member.roles.cache.has(roleId)) await member.roles.remove(roleId);
                if (member.voice.channel) await member.voice.setChannel(null);
            }
            await db.collection('despachos_activos').doc(userId).delete();
        } catch (e) { console.error(e); }
    }
};