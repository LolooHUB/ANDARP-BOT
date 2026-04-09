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
 * Funcionalidad: Dropbox de selección, 3 Despachos y Movimiento Automático.
 */

module.exports = {
    name: 'despacho',
    description: 'Gestiona los roles de despacho con persistencia y sistema de sala de espera.',

    // --- 📂 CONFIGURACIÓN DE DESPACHOS ---
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
            role: '1490394004569722890', 
            voice: '1491829800451444747',
            canalTexto: '1491839298356379668',
            nombre: 'Despacho de Anas' 
        }
    },
    salaEsperaId: '1491829520779444314',

    async execute(message, args) {
        const prefix = '!';
        const fullContent = message.content.trim();
        // Extraemos el nombre del comando correctamente (despacho o cdespacho)
        const commandName = fullContent.slice(prefix.length).split(/ +/)[0].toLowerCase();
        const targetMember = message.mentions.members.first();

        // 1. Verificación de permisos: ¿Es dueño de algún despacho?
        const configEjecutor = this.config[message.author.id];
        if (!configEjecutor) {
            return message.reply('❌ **Error de Permisos:** No estás autorizado para gestionar despachos.');
        }

        // 2. Verificación de mención
        if (!targetMember) {
            return message.reply(`📖 **Uso Correcto:**\n✅ Asignar: \`${prefix}despacho @usuario [tiempo]\`\n❌ Cancelar: \`${prefix}cdespacho @usuario\``);
        }

        // --- LÓGICA DE CANCELACIÓN (!cdespacho) ---
        if (commandName === 'cdespacho') {
            await this.finalizarDespacho(message.guild, targetMember.id, configEjecutor.role);
            return message.reply(`✅ **Acceso Revocado:** Se han retirado los permisos a ${targetMember} y se ha desconectado si estaba en voz.`);
        }

        // --- LÓGICA DE ASIGNACIÓN (!despacho) ---
        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h';
            await this.asignarDespacho(message.guild, targetMember, message.author.id, tiempoRaw, message.channel.id);
            return message.reply(`✅ **Acceso Concedido:** ${targetMember} ahora tiene acceso por **${tiempoRaw}**.`);
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
            .setFooter({ text: 'El dueño recibirá una notificación inmediata para moverte.' });

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

        const collector = msgPregunta.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== member.id) return i.reply({ content: '❌ Esta no es tu solicitud.', ephemeral: true });

            const eleccionId = i.values[0];
            const dataDespacho = this.config[eleccionId];
            const canalDueño = i.guild.channels.cache.get(dataDespacho.canalTexto);

            if (!canalDueño) return i.reply({ content: '❌ Error: Canal del despacho no encontrado.', ephemeral: true });

            const rowAcceso = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`apr_desp_${member.id}_${eleccionId}`).setLabel('Permitir Entrada').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`den_desp_${member.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
            );

            const embedNotif = new EmbedBuilder()
                .setTitle('🔔 Solicitud de Acceso')
                .setDescription(`El ciudadano ${member} está en la sala de espera y solicita entrar.\n\nAl permitirlo, será **movido automáticamente** al canal de voz.`)
                .setColor('#e1ff00')
                .setTimestamp();

            await canalDueño.send({ 
                content: `<@${eleccionId}>`, 
                embeds: [embedNotif], 
                components: [rowAcceso] 
            });

            await i.update({ content: `⏳ Solicitud enviada al **${dataDespacho.nombre}**. Espera a ser movido...`, embeds: [], components: [] });
        });
    },

    // --- 🔓 MANEJO DE BOTONES (Aprobación y Movimiento) ---
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

            // 1. Asignar rol y persistencia (1 hora por defecto)
            await this.asignarDespacho(interaction.guild, member, ownerId, '1h', interaction.channel.id);
            
            // 2. MOVIMIENTO AUTOMÁTICO DE VOZ
            if (member.voice.channel) {
                try {
                    await member.voice.setChannel(dataDespacho.voice);
                } catch (error) {
                    console.error("Error al mover usuario:", error);
                }
            }

            await interaction.update({ content: `✅ Acceso concedido. ${member.user.tag} ha sido movido al despacho.`, components: [] });
            
            const canalEspera = interaction.guild.channels.cache.get(this.salaEsperaId);
            if (canalEspera) await canalEspera.send(`✅ ${member}, tu acceso ha sido aprobado. ¡Disfruta de la estancia!`);
        }
    },

    async asignarDespacho(guild, targetMember, ejecutorId, tiempoRaw, canalLogId) {
        const config = this.config[ejecutorId];
        if (!config) return;
        const role = guild.roles.cache.get(config.role);
        const tiempoMs = ms(tiempoRaw);
        if (!tiempoMs || !role) return;

        try {
            await targetMember.roles.add(role);
            await db.collection('despachos_activos').doc(targetMember.id).set({
                guildId: guild.id,
                roleId: config.role,
                expiracion: Date.now() + tiempoMs,
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
                if (member.voice.channel) await member.voice.setChannel(null); // Desconectar al terminar
            }
            await db.collection('despachos_activos').doc(userId).delete();
        } catch (e) { console.error(e); }
    }
};