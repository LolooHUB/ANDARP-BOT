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
 * Funcionalidad: Dropbox de selección, 3 Despachos, Movimiento Automático y !cdespacho.
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
    salaEsperaId: '1491866105310871797',

    async execute(message, args) {
        const prefix = '!';
        const fullContent = message.content.trim();
        const commandName = fullContent.slice(prefix.length).split(/ +/)[0].toLowerCase();
        const targetMember = message.mentions.members.first();

        // 1. Verificación de permisos
        const configEjecutor = this.config[message.author.id];
        if (!configEjecutor) {
            return message.reply('❌ **Error:** No estás autorizado para gestionar despachos.');
        }

        // 2. Verificación de mención
        if (!targetMember) {
            return message.reply(`📖 **Uso Correcto:**\n✅ Asignar: \`${prefix}despacho @usuario [tiempo]\`\n❌ Cancelar: \`${prefix}cdespacho @usuario\``);
        }

        // --- LÓGICA DE CANCELACIÓN (!cdespacho) ---
        if (commandName === 'cdespacho') {
            await this.finalizarDespacho(message.guild, targetMember.id, configEjecutor.role);
            return message.reply(`✅ **Acceso Revocado:** Se han retirado los permisos a ${targetMember}.`);
        }

        // --- LÓGICA DE ASIGNACIÓN (!despacho) ---
        if (commandName === 'despacho') {
            const tiempoRaw = args[1] || '1h';
            await this.asignarDespacho(message.guild, targetMember, message.author.id, tiempoRaw, message.channel.id);
            return message.reply(`✅ **Acceso Concedido:** ${targetMember} por **${tiempoRaw}**.`);
        }
    },

    // --- 📥 DETECTAR ENTRADA A SALA DE ESPERA (Llamado desde index.js) ---
    async handleWaitingRoom(oldState, newState) {
        if (newState.channelId !== this.salaEsperaId) return;
        const member = newState.member;
        if (member.user.bot) return;

        // Intentamos obtener el canal (chat de voz o canal de texto de la sala)
        const canalEspera = newState.guild.channels.cache.get(this.salaEsperaId);
        if (!canalEspera) return;

        const welcomeEmbed = new EmbedBuilder()
            .setColor('#f1c40f')
            .setTitle('🏢 Centro de Visitas - Anda RP')
            .setDescription(`Hola ${member}, selecciona a qué despacho deseas solicitar acceso:`)
            .setFooter({ text: 'Se te moverá automáticamente al ser aceptado.' });

        const selectMenu = new StringSelectMenuBuilder()
            .setCustomId('select_despacho_espera')
            .setPlaceholder('🚪 Elige un despacho...')
            .addOptions(
                Object.entries(this.config).map(([id, data]) => ({
                    label: data.nombre,
                    value: id,
                    emoji: '📂'
                }))
            );

        const row = new ActionRowBuilder().addComponents(selectMenu);

        const msgPregunta = await canalEspera.send({ 
            content: `${member}`, 
            embeds: [welcomeEmbed], 
            components: [row] 
        }).catch(console.error);

        // Colector para el Dropbox
        const collector = msgPregunta.createMessageComponentCollector({ 
            componentType: ComponentType.StringSelect, 
            time: 60000 
        });

        collector.on('collect', async i => {
            if (i.user.id !== member.id) return i.reply({ content: '❌ No es tu turno.', ephemeral: true });

            const eleccionId = i.values[0];
            const dataDespacho = this.config[eleccionId];
            const canalDueño = i.guild.channels.cache.get(dataDespacho.canalTexto);

            if (!canalDueño) return i.reply({ content: '❌ Error: Canal de destino no encontrado.', ephemeral: true });

            const rowAcceso = new ActionRowBuilder().addComponents(
                new ButtonBuilder().setCustomId(`apr_desp_${member.id}_${eleccionId}`).setLabel('Permitir Entrada').setStyle(ButtonStyle.Success),
                new ButtonBuilder().setCustomId(`den_desp_${member.id}`).setLabel('Denegar').setStyle(ButtonStyle.Danger)
            );

            await canalDueño.send({ 
                content: `<@${eleccionId}>`, 
                embeds: [new EmbedBuilder().setTitle('🔔 Solicitud').setDescription(`${member} solicita entrar a tu despacho.`).setColor('#e1ff00')], 
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

            if (!member) return interaction.update({ content: '❌ El usuario ya no está.', components: [] });

            // 1. Asignar rol y persistencia
            await this.asignarDespacho(interaction.guild, member, ownerId, '1h');
            
            // 2. MOVIMIENTO AUTOMÁTICO
            if (member.voice.channel) {
                await member.voice.setChannel(dataDespacho.voice).catch(console.error);
            }

            await interaction.update({ content: `✅ Acceso concedido a ${member.user.tag}.`, components: [] });
            
            const canalEspera = interaction.guild.channels.cache.get(this.salaEsperaId);
            if (canalEspera) await canalEspera.send(`✅ ${member}, acceso aprobado al **${dataDespacho.nombre}**.`);
        }
    },

    async asignarDespacho(guild, targetMember, ejecutorId, tiempoRaw) {
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
                if (member.voice.channel) await member.voice.setChannel(null); 
            }
            await db.collection('despachos_activos').doc(userId).delete();
        } catch (e) { console.error(e); }
    }
};