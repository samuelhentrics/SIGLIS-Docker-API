const express = require('express');
const mongoose = require('mongoose');

// Créer une instance d'Express
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE');
  res.header('Access-Control-Allow-Headers', 'Content-Type');
  next();
});

// Connexion à MongoDB
//mongoose.connect('mongodb://ycabrol:AECDTQN@ihatia:27017/nodenot_bd1?authSource=admin');
mongoose.connect('mongodb://127.0.0.1:27017/nodenot_bd1?authSource=admin');

const conn = mongoose.connection;
conn.on('error', console.error.bind(console, 'Erreur de connexion à MongoDB :'));
conn.once('open', () => {
  console.log('Connecté à MongoDB');
});

// app.get('/api/collections', async (req, res) => {
//   try {
//     console.log("Test")
//     console.log("API Collections")
//     const collections = await conn.db.listCollections().toArray();

//     console.log(collections)
//     res.json(collections);
//   } catch (error) {
//     console.error('Erreur lors de la récupération des commandes :', error);
//     res.status(500).json({ error: 'Erreur serveur' });
//   }
// });

// Commandes
app.get('/api/commandes', async (req, res) => {
  try {
    console.log("API Commandes")
    const commandes = await conn.db.collection('Commandes').find().toArray();
    res.json(commandes);
  } catch (error) {
    console.error('Erreur lors de la récupération des commandes :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/commandes/:id', async (req, res) => {
  let id = req.params.id;
  try {
    id = parseInt(id)
    console.log("API Commandes : " + id)
    // On va chercher la commande dans la base de données mais on va utiliser la méthode aggregate
    const commande = await conn.db.collection('Commandes').aggregate([
      // On va chercher la commande qui a le numéro passé en paramètre
      { $match: { "Numero": id } },
      // En garder qu'un seul
      { $limit: 1 },
      // On va séparer les lignes de détails pour les traiter une par une
      { $unwind: '$LignesDeCommande' },
      // On fait un "join" avec la collection Articles
      {
        $lookup: {
          from: 'Articles',
          localField: 'LignesDeCommande.Article',
          foreignField: '_id',
          as: 'LignesDeCommande.Article'
        }
      },
      // On refait un unwind pour avoir une ligne par article
      { $unwind: '$LignesDeCommande.Article' },

      // Calcul du prix TTC d'un article
      {
        $set: {
          'LignesDeCommande.Article.PrixTTC': {
            $round: [{
              $multiply: [
                '$LignesDeCommande.Article.PrixHT',
                { $add: [1, '$LignesDeCommande.Article.Tva.TauxTVA'] }
              ]},
              2
            ]
          }
        }
      },

      // Calcul du prix total de la ligne
      {
        $set: {
          'LignesDeCommande.PrixTotal': {
            $round: [{
              $multiply: [
                '$LignesDeCommande.Quantite',
                '$LignesDeCommande.Article.PrixHT',
                { $add: [1, '$LignesDeCommande.Article.Tva.TauxTVA'] }
              ]},
              2
            ]
          }
        }
      },

      // On regroupe les lignes de détails pour avoir un tableau
      {
        $group: {
          _id: '$_id',
          Numero: { $first: '$Numero' },
          NomClient: { $first: '$NomClient' },
          DateCommande: { $first: '$DateCommande' },
          LignesDeCommande: { $push: '$LignesDeCommande' },
          // Arrondir le prix total à 2 décimales en faisant la somme des prix totaux des lignes
          PrixTotal: { $sum: '$LignesDeCommande.PrixTotal' }
          
        }
      },

      // Arrondir le prix total à 2 décimales
      { $set: { PrixTotal: { $round: ['$PrixTotal', 2] } } },

      

    ]).toArray();
    //console.log(commande[0])
    res.json(commande[0]);
  } catch (error) {
    console.error("Erreur lors de la récupération de la commande" + id + " :", error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// Articles
app.get('/api/articles', async (req, res) => {
  try {
    console.log("API Articles")
    const articles = await conn.db.collection('Articles').aggregate([
      // Unwind
      {
        $set: {
          'PrixTTC': {
            $round: [{
              $multiply: [
                '$PrixHT',
                { $add: [1, '$Tva.TauxTVA'] }
              ]},
              2
            ]
          }
        }
      },

    ]).toArray();

    res.json(articles);
  } catch (error) {
    console.error('Erreur lors de la récupération des articles :', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/articles/:id', async (req, res) => {
  let id = req.params.id;
  try {
    console.log("API Articles : " + id)
    
    // Recherche
    const article = await conn.db.collection('Articles').aggregate([
      // On va chercher la commande qui a le numéro passé en paramètre
      { $match: { "Reference": id } },
      // En garder qu'un seul
      { $limit: 1 },

      // Calcul du prix TTC d'un article
      {
        $set: {
          'PrixTTC': {
            $round: [{
              $multiply: [
                '$PrixHT',
                { $add: [1, '$Tva.TauxTVA'] }
              ]},
              2
            ]
          }
        }
      },

    ]).toArray();
    //console.log(article[0])
    res.json(article[0]);
  } catch (error) {
    console.error("Erreur lors de la récupération de l'article" + id + " :", error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});


app.listen(PORT, () => {
  console.log(`Serveur en cours d'exécution sur le port ${PORT}`);
});
