const { 
    EmbedBuilder, 
    ActionRowBuilder, 
    ButtonBuilder, 
    ButtonStyle, 
    ComponentType, 
    StringSelectMenuBuilder 
} = require('discord.js');
const ms = require('ms');
const { db } = require('../Comandos/Automatizaciones/firebase');

/**
 * SISTEMA DE DESPACHOS PROFESIONAL - ANDA RP
 * Actualizado: Dropbox de selección, 3 Despachos y Notificación en canales.
 */

module.exports = {
    name: 'despacho',
    description: 'Gestiona los roles de despacho con persistencia y sistema de sala de espera.',

    // --- 📂 CONFIGURACIÓN DE DESPACHOS (Sincronizado con IDs proporcionados) ---
    config: {
        '824811313989419018': { // Lolo_
            role: '1490394005094006876', 
            voice: '1491829800451444746', 
            canalTexto: '1482564249090658364',
            nombre: 'Despacho de Lolo_' 
        },
        '1315779036076707902': { // Francisco Javier
            role: '1490394004569722890', 
            voice: '1491829800451444747',
            canalTexto: '1491839298356379668',
            nombre: 'Despacho de Francisco Javier' 
        },
        '1324001245735686146': { // Anas
            role: 'ID_ROL_ANAS', // Agrega el ID del Rol para Anas
            voice: 'ID_VOICE_ANAS', // Agrega el ID del canal de Voz para Anas
            canalTexto: '1491839298356379668', // ID del canal proporcionado
            nombre: 'Despacho de Anas' 
        }
    },
    salaEsperaId: '1491829520779444314',

    async execute(message, args) {
        const prefix = '!';
        const fullContent = message.content.trim();
        const commandName = fullContent.slice(prefix.length).split(/ +/)[0].toLowerCase();
        const targetMember = message.mentions.members.first();

        // Solo el dueño puede usar comandos manuales sobre otros
        if (!this.config[message.author.id]) return message.reply('❌ No estás autorizado.');

        if (!targetMember) return message.reply(`📖 Uso: \`${prefix}despacho @usuario [tiempo]\` o \`${prefix}cdespacho @usuario\``);

        if (commandName === 'cdespacho') {
            await this.finalizarDespacho(message.guild, targetMember.id, this.config[message.author.id].role);
            return message.reply(`✅ Acceso revocado para ${targetMember}.`);
        }

        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h';
            await this.asignarDespacho(message.guild, targetMember, message.author.id, tiempoRaw, message.channel.id);
        }
    },

    // --- 📥 DETECTAR ENTRADA A SALA DE ESPERA ---
    async handleWaitingRoom(oldState, newState) {
        if (newState.channelId !== this.salaEsperaId) return;
        const member = newState.member;
        if (member.user.bot) return;

        const canalTextoEspera = newState.guild.channels.cache.get(this.salaEsperaId);
        if (!canalTextoEspera) return;

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🏢 Centro de Visitas - Anda RP')
            .setDescription(`Bienvenido ${member}.\nPor favor, selecciona abajo el despacho al que deseas solicitar acceso.`)
            .setFooter({ text: 'El dueño recibirá una notificación inmediata.' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_despacho_espera')
            .setPlaceholder('Selecciona un despacho...')
            .addOptions(
                Object.entries(this.config).map(([id, data]) => ({
                    label: data.nombre,
                    value: id,
                    emoji: '🚪'
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);
        const msgPregunta = await canalTextoEspera.send({ content: `${member}`, embeds: [welcomeEmbed], components: [row] });

        // Colector para la selección del Dropbox
        const filter = i => i.customId === 'select_despacho_espera' && i.user.id === member.id;
        const collector = msgPregunta.createMessageComponentCollector({ componentType: ComponentType.StringSelect, time: 60000 });

        collector.on('collect', async i => {
            const eleccionId = i.values[0];
            const dataDespacho = this.config[eleccionId];
            const canalDueño = i.guild.channels.cache.get(dataDespacho.canalTexto);

            if (!canalDueño) return i.reply({ content: '❌ Error: No se encontró el canal del despacho.', ephemeral: true });

            const rowAcceso = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`apr_desp_${member.id}_${eleccionId}`).setLabel('Permitir Entrada').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`den_desp_${member.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
            );

            const embedNotif = new EmbedBuilder()
                .setTitle('🔔 Nueva Solicitud de Acceso')
                .setDescription(`El ciudadano ${member} está en la sala de espera y desea entrar a tu despacho.`)
                .setColor('#e1ff00')
                .setTimestamp();

            // Enviar notificación al canal del despacho haciendo ping al dueño
            await canalDueño.send({ 
                content: `<@${eleccionId}>`, 
                embeds: [embedNotif], 
                components: [rowAcceso] 
            });

            await i.update({ content: `⏳ Solicitud enviada al **${dataDespacho.nombre}**. Espera respuesta...`, embeds: [], components: [] });
        });
    },

    // --- 🔓 MANEJO DE BOTONES (Debe llamarse desde index.js) ---
    async handleButtons(interaction) {
        if (!interaction.isButton()) return;
        const [accion, , userId, ownerId] = interaction.customId.split('_');
        
        if (accion === 'den') {
            return interaction.update({ content: '❌ Solicitud denegada.', components: [] });
        }

        if (accion === 'apr') {
            const member = await interaction.guild.members.fetch(userId).catch(() => null);
            const dataDespacho = this.config[ownerId];

            if (!member) return interaction.update({ content: '❌ El usuario ya no está en el servidor.', components: [] });

            // 1. Asignar rol y persistencia
            await this.asignarDespacho(interaction.guild, member, ownerId, '1h', interaction.channel.id);
            
            // 2. Mover de voz si está conectado
            if (member.voice.channel) {
                await member.voice.setChannel(dataDespacho.voice).catch(() => {});
            }

            await interaction.update({ content: `✅ Acceso concedido a ${member.user.tag}.`, components: [] });
            
            const canalEspera = interaction.guild.channels.cache.get(this.salaEsperaId);
            if (canalEspera) await canalEspera.send(`✅ ${member}, tu acceso al **${dataDespacho.nombre}** ha sido aprobado.`);
        }
    },

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