import React, { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform, Pressable, SafeAreaView, ScrollView, StatusBar, StyleSheet, Text, TextInput, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { supabase } from "./src/lib/supabase";

const CATEGORIES = ["Tous", "Téléphones", "Informatique", "Véhicules", "Immobilier", "Maison", "Mode", "Électroménager", "Sports", "Loisirs", "Autres"];
const WILAYAS = ["Alger","Blida","Tipaza","Boumerdès","Oran","Constantine","Tizi Ouzou","Béjaïa","Sétif","Annaba"];
const money = n => new Intl.NumberFormat("fr-DZ").format(Number(n || 0)) + " DA";

export default function App() {
  const [session,setSession] = useState(null);
  const [profile,setProfile] = useState(null);
  const [products,setProducts] = useState([]);
  const [favorites,setFavorites] = useState([]);
  const [category,setCategory] = useState("Tous");
  const [search,setSearch] = useState("");
  const [tab,setTab] = useState("Accueil");
  const [loading,setLoading] = useState(true);
  const [authVisible,setAuthVisible] = useState(false);
  const [register,setRegister] = useState(false);
  const [email,setEmail] = useState("");
  const [password,setPassword] = useState("");
  const [first,setFirst] = useState("");
  const [last,setLast] = useState("");
  const [phone,setPhone] = useState("");
  const [wilaya,setWilaya] = useState("Alger");
  const [commune,setCommune] = useState("");
  const [busy,setBusy] = useState(false);
  const [selected,setSelected] = useState(null);
  const [publishVisible,setPublishVisible] = useState(false);
  const [name,setName] = useState("");
  const [description,setDescription] = useState("");
  const [price,setPrice] = useState("");
  const [oldPrice,setOldPrice] = useState("");
  const [newCategory,setNewCategory] = useState("Téléphones");
  const [condition,setCondition] = useState("Bon état");
  const [delivery,setDelivery] = useState("À discuter");
  const [photos,setPhotos] = useState([]);
  const [orders,setOrders] = useState([]);
  const [conversations,setConversations] = useState([]);
  const [chat,setChat] = useState(null);
  const [messages,setMessages] = useState([]);
  const [messageText,setMessageText] = useState("");

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(async ({data}) => {
      if (!mounted) return;
      setSession(data.session);
      if (data.session?.user) await loadProfile(data.session.user.id);
      await loadProducts();
      setLoading(false);
    });
    const {data:{subscription}} = supabase.auth.onAuthStateChange(async (_event,next) => {
      setSession(next);
      if (next?.user) await loadProfile(next.user.id);
      else { setProfile(null); setFavorites([]); setOrders([]); }
    });
    return () => { mounted = false; subscription.unsubscribe(); };
  },[]);

  useEffect(() => { if (session?.user) { loadFavorites(); loadOrders(); loadConversations(); } },[session?.user?.id]);

  async function loadProfile(id) {
    const {data,error} = await supabase.from("profiles").select("*").eq("id",id).maybeSingle();
    if (error) console.warn("profile",error.message);
    setProfile(data || null);
  }
  async function loadProducts() {
    const {data,error} = await supabase.from("products").select("*").order("created_at",{ascending:false});
    if (error) { Alert.alert("SouqDZ", "Chargement impossible : " + error.message); return; }
    setProducts((data || []).filter(p => p.status === "ACTIVE"));
  }
  async function loadFavorites() {
    if (!session?.user) return;
    const {data,error} = await supabase.from("favorites").select("product_id").eq("user_id",session.user.id);
    if (!error) setFavorites((data || []).map(x=>x.product_id));
  }
  async function loadConversations() {
    if (!session?.user) return;
    const id=session.user.id;
    const {data,error}=await supabase.from("conversations").select("*").or("buyer_id.eq."+id+",seller_id.eq."+id).order("created_at",{ascending:false});
    if (error) { console.warn("conversations",error.message); return; }
    setConversations(data || []);
  }
  async function loadMessages(conversationId) {
    const {data,error}=await supabase.from("messages").select("*").eq("conversation_id",conversationId).order("created_at",{ascending:true});
    if (error) return Alert.alert("Messages",error.message);
    setMessages(data || []);
    const unread=(data || []).filter(m=>m.sender_id!==session?.user?.id&&!m.is_read).map(m=>m.id);
    if (unread.length) await supabase.from("messages").update({is_read:true}).in("id",unread);
  }
  async function startChat(product) {
    if (!session?.user) { setAuthVisible(true); return; }
    if (product.seller_id===session.user.id) return Alert.alert("SouqDZ","Tu ne peux pas contacter ton propre compte.");
    const {data,error}=await supabase.from("conversations").upsert({product_id:product.id,buyer_id:session.user.id,seller_id:product.seller_id},{onConflict:"product_id,buyer_id,seller_id"}).select().single();
    if (error) return Alert.alert("Conversation",error.message);
    setChat({conversation:data,product});
    await loadMessages(data.id);
    await loadConversations();
  }
  async function sendMessage() {
    const contenu=messageText.trim();
    if (!contenu || !chat || !session?.user) return;
    setBusy(true);
    const {error}=await supabase.from("messages").insert({conversation_id:chat.conversation.id,sender_id:session.user.id,contenu});
    setBusy(false);
    if (error) return Alert.alert("Envoi impossible",error.message);
    setMessageText(""); await loadMessages(chat.conversation.id); await loadConversations();
  }
  async function loadOrders() {
    if (!session?.user) return;
    const id=session.user.id;
    const {data,error}=await supabase.from("orders").select("*").or(`buyer_id.eq.${id},seller_id.eq.${id}`).order("created_at",{ascending:false});
    if (!error) setOrders(data || []);
  }

  const visible = useMemo(() => products.filter(p => (category==="Tous" || p.categorie===category) && (String(p.nom||"")+" "+String(p.description||"")+" "+String(p.wilaya||"")).toLowerCase().includes(search.toLowerCase())),[products,category,search]);
  const favoriteProducts = products.filter(p=>favorites.includes(p.id));

  async function authenticate() {
    if (!email.trim() || !password) return Alert.alert("Informations manquantes","Entre ton e-mail et ton mot de passe.");
    setBusy(true);
    try {
      if (register) {
        if (!first.trim() || !last.trim() || !phone.trim() || !commune.trim()) throw new Error("Complète ton nom, téléphone et commune.");
        const {data,error}=await supabase.auth.signUp({email:email.trim(),password});
        if (error) throw error;
        if (!data.user) throw new Error("Compte non créé.");
        const {error:profileError}=await supabase.from("profiles").insert({id:data.user.id,prenom:first.trim(),nom:last.trim(),telephone:phone.trim(),wilaya,commune:commune.trim()});
        if (profileError) throw profileError;
        setProfile({id:data.user.id,prenom:first,nom:last,telephone:phone,wilaya,commune});
        Alert.alert("SouqDZ","Compte créé. Si la confirmation e-mail est activée, confirme ton adresse avant de te connecter.");
      } else {
        const {error}=await supabase.auth.signInWithPassword({email:email.trim(),password});
        if (error) throw error;
        setAuthVisible(false);
      }
    } catch(e) { Alert.alert("Erreur",e.message || "Une erreur est survenue."); }
    finally { setBusy(false); }
  }

  async function logout() {
    await supabase.auth.signOut();
    setSession(null); setProfile(null); setTab("Accueil"); setConversations([]); setChat(null); setMessages([]);
  }
  async function toggleFavorite(p) {
    if (!session?.user) { setAuthVisible(true); return; }
    const exists=favorites.includes(p.id);
    const {error}=exists
      ? await supabase.from("favorites").delete().eq("user_id",session.user.id).eq("product_id",p.id)
      : await supabase.from("favorites").insert({user_id:session.user.id,product_id:p.id});
    if (error) Alert.alert("Favoris",error.message);
    else setFavorites(old=>exists?old.filter(id=>id!==p.id):[...old,p.id]);
  }
  async function choosePhotos() {
    const permission=await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) return Alert.alert("Photos","Autorise l'accès aux photos.");
    const result=await ImagePicker.launchImageLibraryAsync({mediaTypes:["images"],allowsMultipleSelection:true,selectionLimit:6,quality:0.7,base64:true});
    if (!result.canceled) setPhotos(result.assets.slice(0,6).map(a=>`data:image/jpeg;base64,${a.base64}`).filter(x=>!x.endsWith("base64,undefined")));
  }
  async function publish() {
    if (!session?.user) { setPublishVisible(false); setAuthVisible(true); return; }
    if (!name.trim() || !description.trim() || !price || Number(price)<=0 || !commune.trim()) return Alert.alert("Champs obligatoires","Remplis le titre, description, prix et commune.");
    setBusy(true);
    const {error}=await supabase.from("products").insert({
      seller_id:session.user.id,nom:name.trim(),description:description.trim(),prix:Number(price),
      ancien_prix:Number(oldPrice)>Number(price)?Number(oldPrice):null,categorie:newCategory,etat:condition,
      wilaya,commune:commune.trim(),livraison:delivery,images:photos,status:"ACTIVE"
    });
    setBusy(false);
    if (error) return Alert.alert("Publication impossible",error.message);
    setPublishVisible(false); setName("");setDescription("");setPrice("");setOldPrice("");setPhotos([]);
    await loadProducts();setTab("Accueil");Alert.alert("SouqDZ","Ton annonce est publiée.");
  }
  async function updateOrder(orderId,status) {\n    const {error}=await supabase.from("orders").update({status}).eq("id",orderId);\n    if(error) return Alert.alert("Commande",error.message);\n    await loadOrders();\n  }\n  async function placeOrder() {
    if (!session?.user) { setSelected(null);setAuthVisible(true);return; }
    if (!selected) return;
    const buyerName=[profile?.prenom,profile?.nom].filter(Boolean).join(" ") || "Acheteur";
    const {error}=await supabase.from("orders").insert({
      product_id:selected.id,seller_id:selected.seller_id,buyer_id:session.user.id,product_nom:selected.nom,
      quantite:1,prix_total:Number(selected.prix),nom_acheteur:buyerName,telephone:profile?.telephone || "",
      wilaya:profile?.wilaya || selected.wilaya,commune:profile?.commune || selected.commune,adresse:profile?.commune || "",
      mode_livraison:selected.livraison || "À discuter",status:"EN_ATTENTE"
    });
    if(error) return Alert.alert("Commande impossible",error.message);
    setSelected(null);await loadOrders();Alert.alert("Commande envoyée","Le vendeur pourra te contacter.");
  }

  if (loading) return <SafeAreaView style={styles.center}><ActivityIndicator size="large" color="#0e7c66"/><Text style={styles.muted}>Chargement de SouqDZ…</Text></SafeAreaView>;

  return <SafeAreaView style={styles.safe}>
    <StatusBar barStyle="dark-content"/>
    <View style={styles.header}>
      <View><Text style={styles.logo}>Souq<Text style={{color:"#f4a300"}}>DZ</Text></Text><Text style={styles.tag}>Achetez · Vendez · Découvrez</Text></View>
      <Pressable style={styles.account} onPress={()=>session?setTab("Compte"):setAuthVisible(true)}><Text style={styles.accountText}>{session ? (profile?.prenom || "Compte") : "Connexion"}</Text></Pressable>
    </View>
    <View style={styles.search}><Text style={{fontSize:18}}>⌕</Text><TextInput value={search} onChangeText={setSearch} placeholder="Rechercher un produit, une wilaya…" style={styles.searchInput}/></View>
    <View style={styles.nav}>
      {["Accueil","Favoris","Commandes","Messages","Compte"].map(t=><Pressable key={t} onPress={()=>setTab(t)} style={[styles.navItem,tab===t&&styles.navActive]}><Text style={[styles.navText,tab===t&&styles.navTextActive]}>{t}</Text></Pressable>)}
    </View>
    {tab==="Accueil" && <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}><Text style={styles.heroTitle}>Le marché algérien, dans ta poche.</Text><Text style={styles.heroSub}>Trouve ce que tu cherches ou publie ton annonce.</Text><Pressable style={styles.heroButton} onPress={()=>setPublishVisible(true)}><Text style={styles.heroButtonText}>＋ Publier une annonce</Text></Pressable></View>
      <Text style={styles.section}>Catégories</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{marginBottom:18}}>{CATEGORIES.map(c=><Pressable key={c} onPress={()=>setCategory(c)} style={[styles.chip,category===c&&styles.chipActive]}><Text style={[styles.chipText,category===c&&styles.chipTextActive]}>{c}</Text></Pressable>)}</ScrollView>
      <View style={styles.sectionRow}><Text style={styles.section}>Annonces récentes</Text><Pressable onPress={loadProducts}><Text style={styles.refresh}>Actualiser ↻</Text></Pressable></View>
      <View style={styles.grid}>{visible.map(p=><ProductCard key={p.id} product={p} favorite={favorites.includes(p.id)} onOpen={()=>setSelected(p)} onFavorite={()=>toggleFavorite(p)}/>)}</View>
      {!visible.length&&<Text style={styles.empty}>Aucune annonce trouvée.</Text>}
    </ScrollView>}
    {tab==="Favoris"&&<ScrollView contentContainerStyle={styles.content}><Text style={styles.section}>Mes favoris</Text><View style={styles.grid}>{favoriteProducts.map(p=><ProductCard key={p.id} product={p} favorite onOpen={()=>setSelected(p)} onFavorite={()=>toggleFavorite(p)}/>)}</View>{!favoriteProducts.length&&<Text style={styles.empty}>Connecte-toi et ajoute des annonces à tes favoris.</Text>}</ScrollView>}
    {tab==="Messages"&&<ScrollView contentContainerStyle={styles.content}><Text style={styles.section}>Mes conversations</Text>{conversations.map(c=>{const p=products.find(x=>x.id===c.product_id);return <Pressable key={c.id} style={styles.order} onPress={async()=>{setChat({conversation:c,product:p||{nom:"Produit"}});await loadMessages(c.id);}}><Text style={styles.productName}>{p?.nom || "Produit"}</Text><Text style={styles.muted}>Ouvrir la discussion ›</Text></Pressable>;})}{!conversations.length&&<Text style={styles.empty}>Aucune conversation. Contacte un vendeur depuis une annonce.</Text>}</ScrollView>}
    {tab==="Commandes"&&<ScrollView contentContainerStyle={styles.content}><Text style={styles.section}>Mes commandes</Text>{orders.map(o=><View key={o.id} style={styles.order}><Text style={styles.productName}>{o.product_nom} × {o.quantite || 1}</Text><Text style={styles.price}>{money(o.prix_total)}</Text><Text style={styles.muted}>Statut : {o.status} · {o.commune}, {o.wilaya}</Text>{o.seller_id===session?.user?.id&&o.status==="EN_ATTENTE"&&<View style={styles.orderActions}><Pressable style={styles.primaryButton} onPress={()=>updateOrder(o.id,"ACCEPTEE")}><Text style={styles.primaryText}>Accepter</Text></Pressable><Pressable style={styles.outlineButton} onPress={()=>updateOrder(o.id,"REFUSEE")}><Text style={styles.outlineText}>Refuser</Text></Pressable></View>}{o.seller_id===session?.user?.id&&o.status==="ACCEPTEE"&&<Pressable style={styles.primaryButton} onPress={()=>updateOrder(o.id,"EN_PREPARATION")}><Text style={styles.primaryText}>Préparer</Text></Pressable>}{o.seller_id===session?.user?.id&&o.status==="EN_PREPARATION"&&<Pressable style={styles.primaryButton} onPress={()=>updateOrder(o.id,"EXPEDIEE")}><Text style={styles.primaryText}>Expédier</Text></Pressable>}{o.seller_id===session?.user?.id&&o.status==="EXPEDIEE"&&<Pressable style={styles.primaryButton} onPress={()=>updateOrder(o.id,"LIVREE")}><Text style={styles.primaryText}>Marquer livrée</Text></Pressable>}</View>)}{!orders.length&&<Text style={styles.empty}>Aucune commande pour le moment.</Text>}</ScrollView>}
    {tab==="Compte"&&<View style={styles.content}>{session?<><Text style={styles.section}>Mon compte</Text><Text style={styles.productName}>{profile?.prenom} {profile?.nom}</Text><Text style={styles.muted}>{profile?.telephone} · {profile?.wilaya}</Text><Pressable style={styles.outlineButton} onPress={logout}><Text style={styles.outlineText}>Se déconnecter</Text></Pressable></>:<><Text style={styles.section}>Bienvenue sur SouqDZ</Text><Pressable style={styles.primaryButton} onPress={()=>setAuthVisible(true)}><Text style={styles.primaryText}>Connexion / Inscription</Text></Pressable></>}</View>}
    <View style={styles.bottom}><Text style={styles.bottomText}>SouqDZ · Marketplace algérienne</Text></View>
    <Modal visible={!!selected} animationType="slide" onRequestClose={()=>setSelected(null)}><SafeAreaView style={styles.modalPage}>{selected&&<><View style={styles.modalHead}><Pressable onPress={()=>setSelected(null)}><Text style={styles.close}>← Retour</Text></Pressable><Text style={styles.logoSmall}>SouqDZ</Text></View><ScrollView>{selected.images?.[0]?<Image source={{uri:selected.images[0]}} style={styles.detailImage}/>:<View style={styles.detailPlaceholder}><Text style={{fontSize:54}}>🛍️</Text></View>}<View style={styles.detailBody}><Text style={styles.price}>{money(selected.prix)}</Text><Text style={styles.detailTitle}>{selected.nom}</Text><Text style={styles.muted}>{selected.categorie} · {selected.etat}</Text><Text style={styles.detailDesc}>{selected.description}</Text><Text style={styles.muted}>📍 {selected.commune}, {selected.wilaya}</Text><Text style={styles.muted}>Livraison : {selected.livraison || "À discuter"}</Text><Pressable style={styles.primaryButton} onPress={placeOrder}><Text style={styles.primaryText}>Commander</Text></Pressable><Pressable style={styles.outlineButton} onPress={()=>startChat(selected)}><Text style={styles.outlineText}>Contacter le vendeur</Text></Pressable><Pressable style={styles.outlineButton} onPress={()=>toggleFavorite(selected)}><Text style={styles.outlineText}>{favorites.includes(selected.id)?"Retirer des favoris":"Ajouter aux favoris"}</Text></Pressable></View></ScrollView></>}</SafeAreaView></Modal>
    <Modal visible={!!chat} animationType="slide" onRequestClose={()=>setChat(null)}><SafeAreaView style={styles.modalPage}><View style={styles.modalHead}><Pressable onPress={()=>setChat(null)}><Text style={styles.close}>Retour</Text></Pressable><Text style={styles.logoSmall}>Messages</Text></View>{chat&&<Text style={styles.muted}>Annonce : {chat.product?.nom}</Text>}<FlatList style={{flex:1,padding:14}} data={messages} keyExtractor={m=>String(m.id)} renderItem={({item})=><View style={[styles.bubble,item.sender_id===session?.user?.id?styles.myBubble:styles.theirBubble]}><Text style={{color:"#17201d"}}>{item.contenu}</Text><Text style={styles.muted}>{new Date(item.created_at).toLocaleString("fr-DZ")}</Text></View>} ListEmptyComponent={<Text style={styles.empty}>Commence la discussion par un message.</Text>}/><View style={styles.chatComposer}><TextInput value={messageText} onChangeText={setMessageText} placeholder="Écrire un message..." style={[styles.input,{flex:1}]}/><Pressable onPress={sendMessage} style={styles.sendBtn}><Text style={styles.primaryText}>Envoyer</Text></Pressable></View></SafeAreaView></Modal>
    <Modal visible={authVisible} animationType="slide" onRequestClose={()=>setAuthVisible(false)}><KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.modalPage}><View style={styles.modalHead}><Pressable onPress={()=>setAuthVisible(false)}><Text style={styles.close}>Fermer ✕</Text></Pressable><Text style={styles.logoSmall}>SouqDZ</Text></View><ScrollView contentContainerStyle={styles.form}><Text style={styles.section}>{register?"Créer un compte":"Connexion"}</Text><Pressable onPress={()=>setRegister(!register)}><Text style={styles.refresh}>{register?"Déjà inscrit ? Se connecter":"Pas encore de compte ? S'inscrire"}</Text></Pressable>{register&&<><Field label="Prénom" value={first} onChangeText={setFirst}/><Field label="Nom" value={last} onChangeText={setLast}/><Field label="Téléphone" value={phone} onChangeText={setPhone} keyboardType="phone-pad"/><Field label="Wilaya" value={wilaya} onChangeText={setWilaya}/><Field label="Commune" value={commune} onChangeText={setCommune}/></>}<Field label="E-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none"/><Field label="Mot de passe" value={password} onChangeText={setPassword} secureTextEntry/><Pressable style={styles.primaryButton} disabled={busy} onPress={authenticate}><Text style={styles.primaryText}>{busy?"Patiente…":register?"Créer mon compte":"Se connecter"}</Text></Pressable></ScrollView></KeyboardAvoidingView></Modal>
    <Modal visible={publishVisible} animationType="slide" onRequestClose={()=>setPublishVisible(false)}><KeyboardAvoidingView behavior={Platform.OS==="ios"?"padding":undefined} style={styles.modalPage}><View style={styles.modalHead}><Pressable onPress={()=>setPublishVisible(false)}><Text style={styles.close}>Annuler ✕</Text></Pressable><Text style={styles.logoSmall}>Nouvelle annonce</Text></View><ScrollView contentContainerStyle={styles.form}><Text style={styles.section}>Publier un produit</Text><Field label="Titre" value={name} onChangeText={setName}/><Field label="Description" value={description} onChangeText={setDescription} multiline/><Field label="Prix (DA)" value={price} onChangeText={setPrice} keyboardType="numeric"/><Field label="Ancien prix (facultatif)" value={oldPrice} onChangeText={setOldPrice} keyboardType="numeric"/><Field label="Catégorie" value={newCategory} onChangeText={setNewCategory}/><Field label="État" value={condition} onChangeText={setCondition}/><Field label="Wilaya" value={wilaya} onChangeText={setWilaya}/><Field label="Commune" value={commune} onChangeText={setCommune}/><Field label="Livraison" value={delivery} onChangeText={setDelivery}/><Pressable style={styles.outlineButton} onPress={choosePhotos}><Text style={styles.outlineText}>＋ Ajouter des photos ({photos.length}/6)</Text></Pressable><View style={styles.photoRow}>{photos.map((p,i)=><Image key={i} source={{uri:p}} style={styles.thumb}/>)}</View><Pressable style={styles.primaryButton} disabled={busy} onPress={publish}><Text style={styles.primaryText}>{busy?"Publication…":"Publier l'annonce"}</Text></Pressable></ScrollView></KeyboardAvoidingView></Modal>
  </SafeAreaView>;
}

function ProductCard({product,favorite,onOpen,onFavorite}) {
  return <View style={styles.card}><Pressable onPress={onOpen}>{product.images?.[0]?<Image source={{uri:product.images[0]}} style={styles.cardImage}/>:<View style={styles.cardPlaceholder}><Text style={{fontSize:34}}>🛍️</Text></View>}<View style={styles.cardBody}><Text numberOfLines={2} style={styles.productName}>{product.nom}</Text><Text style={styles.price}>{money(product.prix)}</Text><Text numberOfLines={1} style={styles.muted}>{product.commune}, {product.wilaya}</Text></View></Pressable><Pressable onPress={onFavorite} style={styles.heart}><Text style={{fontSize:20,color:favorite?"#e14b59":"#555"}}>{favorite?"♥":"♡"}</Text></Pressable></View>;
}
function Field({label,...props}) { return <View style={styles.field}><Text style={styles.fieldLabel}>{label}</Text><TextInput placeholder={label} placeholderTextColor="#8b929b" style={[styles.input,props.multiline&&{height:100,textAlignVertical:"top"}]} {...props}/></View>; }

const styles=StyleSheet.create({
 safe:{flex:1,backgroundColor:"#f7f8fa"},center:{flex:1,alignItems:"center",justifyContent:"center",gap:12,backgroundColor:"#f7f8fa"},
 header:{paddingHorizontal:18,paddingTop:12,paddingBottom:10,backgroundColor:"#fff",flexDirection:"row",alignItems:"center",justifyContent:"space-between",borderBottomWidth:1,borderColor:"#e5e7eb"},
 logo:{fontSize:27,fontWeight:"900",color:"#0e7c66",letterSpacing:-1},tag:{fontSize:10,color:"#7a828b",marginTop:-3},account:{paddingVertical:9,paddingHorizontal:13,borderRadius:20,backgroundColor:"#eaf4f1"},accountText:{color:"#0e7c66",fontWeight:"800"},
 search:{margin:14,backgroundColor:"#fff",borderWidth:1,borderColor:"#e5e7eb",borderRadius:12,paddingHorizontal:13,flexDirection:"row",alignItems:"center",gap:8},searchInput:{height:44,flex:1,fontSize:14,color:"#1a1a1a"},
 nav:{flexDirection:"row",backgroundColor:"#fff",borderBottomWidth:1,borderColor:"#e5e7eb"},navItem:{flex:1,alignItems:"center",paddingVertical:12},navActive:{borderBottomWidth:2,borderColor:"#0e7c66"},navText:{fontSize:12,color:"#727b85",fontWeight:"600"},navTextActive:{color:"#0e7c66"},
 content:{padding:16,paddingBottom:35},hero:{backgroundColor:"#0e7c66",borderRadius:18,padding:19,marginBottom:22},heroTitle:{fontSize:23,fontWeight:"900",color:"#fff",lineHeight:29},heroSub:{color:"#e2f2ed",fontSize:13,marginTop:8},heroButton:{alignSelf:"flex-start",marginTop:15,backgroundColor:"#f4a300",paddingHorizontal:14,paddingVertical:11,borderRadius:9},heroButtonText:{fontWeight:"900",color:"#17201d"},
 section:{fontSize:19,fontWeight:"900",color:"#18201e",marginBottom:13},sectionRow:{flexDirection:"row",alignItems:"center",justifyContent:"space-between"},refresh:{color:"#0e7c66",fontWeight:"700",fontSize:13},chip:{paddingHorizontal:14,paddingVertical:9,backgroundColor:"#fff",borderRadius:20,borderWidth:1,borderColor:"#e2e7e5",marginRight:8},chipActive:{backgroundColor:"#0e7c66",borderColor:"#0e7c66"},chipText:{color:"#58615e",fontSize:12},chipTextActive:{color:"#fff",fontWeight:"800"},
 grid:{flexDirection:"row",flexWrap:"wrap",justifyContent:"space-between"},card:{width:"48.5%",backgroundColor:"#fff",borderRadius:13,overflow:"hidden",marginBottom:13,borderWidth:1,borderColor:"#edf0ef"},cardImage:{width:"100%",height:125,backgroundColor:"#eef1f4"},cardPlaceholder:{height:125,backgroundColor:"#eef1f4",alignItems:"center",justifyContent:"center"},cardBody:{padding:10},productName:{fontSize:13,fontWeight:"700",color:"#202725"},price:{fontSize:16,fontWeight:"900",color:"#0e7c66",marginTop:5},muted:{fontSize:11,color:"#7c8581",marginTop:4},heart:{position:"absolute",top:8,right:8,backgroundColor:"#fff",borderRadius:20,width:34,height:34,alignItems:"center",justifyContent:"center"},
 empty:{textAlign:"center",color:"#808984",paddingVertical:28},bottom:{padding:10,alignItems:"center",borderTopWidth:1,borderColor:"#e5e7eb",backgroundColor:"#fff"},bottomText:{fontSize:10,color:"#89918d"},
 modalPage:{flex:1,backgroundColor:"#f7f8fa"},modalHead:{padding:16,backgroundColor:"#fff",flexDirection:"row",justifyContent:"space-between",alignItems:"center",borderBottomWidth:1,borderColor:"#e5e7eb"},close:{color:"#0e7c66",fontWeight:"800"},logoSmall:{color:"#0e7c66",fontWeight:"900",fontSize:17},form:{padding:18,paddingBottom:40},field:{marginBottom:13},fieldLabel:{fontWeight:"700",fontSize:12,color:"#4d5752",marginBottom:6},input:{backgroundColor:"#fff",borderWidth:1,borderColor:"#dfe5e1",borderRadius:10,paddingHorizontal:12,paddingVertical:12,fontSize:14,color:"#1a1a1a"},
 primaryButton:{backgroundColor:"#0e7c66",padding:15,borderRadius:11,alignItems:"center",marginTop:14},primaryText:{color:"#fff",fontWeight:"900",fontSize:14},outlineButton:{borderWidth:1,borderColor:"#0e7c66",padding:13,borderRadius:10,alignItems:"center",marginTop:12},outlineText:{color:"#0e7c66",fontWeight:"800"},
 bubble:{padding:12,borderRadius:12,marginBottom:10,maxWidth:"86%"},myBubble:{alignSelf:"flex-end",backgroundColor:"#dff3eb"},theirBubble:{alignSelf:"flex-start",backgroundColor:"#fff"},chatComposer:{flexDirection:"row",padding:12,gap:8,backgroundColor:"#fff",alignItems:"center"},sendBtn:{backgroundColor:"#0e7c66",padding:12,borderRadius:10},orderActions:{flexDirection:"row",gap:8,alignItems:"center"},detailImage:{width:"100%",height:280,backgroundColor:"#eef1f4"},detailPlaceholder:{height:240,alignItems:"center",justifyContent:"center",backgroundColor:"#eef1f4"},detailBody:{padding:18},detailTitle:{fontSize:23,fontWeight:"900",color:"#18201e",marginTop:6},detailDesc:{fontSize:14,color:"#414a46",lineHeight:22,marginVertical:16},order:{padding:14,backgroundColor:"#fff",borderRadius:12,marginBottom:10},photoRow:{flexDirection:"row",flexWrap:"wrap",gap:8,marginTop:12},thumb:{width:70,height:70,borderRadius:8},});
