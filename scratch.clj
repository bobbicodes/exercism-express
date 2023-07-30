(require '[babashka.fs :as fs]
         '[clojure.string :as str]
         '[cheshire.core :as json]
         '[clojure.test :refer [is]])

(def practice-exercises
  (map #(subs (str %) 19)
       (fs/list-dir "exercises\\practice")))

(def instructions-all
  (for [slug practice-exercises]
    (let [f (fs/file "exercises\\practice" slug "\\.docs\\instructions.md")]
      (slurp f))))

(def solutions-all
  (for [slug practice-exercises]
    (let [f (fs/file "exercises\\practice" slug "\\.meta\\src\\example.clj")]
      (slurp f))))

(def src-all
  (for [slug practice-exercises]
    (let [filename (str/replace slug "-" "_")
          f (fs/file "exercises\\practice" slug "src" (str filename ".clj"))]
      (slurp f))))

(def exercises
  (map #(subs (str/replace % ".clj" "") 15)
       (fs/list-dir "exercise_tests")))

(def test-all
  (for [e exercises]
    (let [f (fs/file "exercise_tests" (str e ".clj"))]
      (slurp f))))

(comment
  (spit "exercises.json" 
        (json/generate-string
         (zipmap practice-exercises src-all) 
         {:pretty true}))
  (spit "tests.json"
        (json/generate-string
         (zipmap exercises test-all)
         {:pretty true}))
  (spit "instructions.json"
        (json/generate-string
         (zipmap (map #(str/replace % "-" "_") practice-exercises)
                 instructions-all)
         {:pretty true}))
  (spit "solutions.json"
        (json/generate-string
         (zipmap (map #(str/replace % "-" "_") practice-exercises)
                 solutions-all)
         {:pretty true}))
  )

(map not= [1 2 3] ["a" "b" "c"])

(defn pvec [bvec b val]
  (let [gvec (gensym "vec__")
        gseq (gensym "seq__")
        gfirst (gensym "first__")
        has-rest (some #{'&} b)]
    (loop [ret (let [ret (conj bvec gvec val)]
                 (if has-rest
                   (conj ret gseq (list seq gvec))
                   ret))
           n 0
           bs b
           seen-rest? false]
      (if (seq bs)
        (let [firstb (first bs)]
          (cond
            (= firstb '&) (recur (pb ret (second bs) gseq)
                                 n
                                 (nnext bs)
                                 true)
            (= firstb :as) (pb ret (second bs) gvec)
            :else (if seen-rest?
                    (throw "Unsupported binding form, only :as can follow & parameter")
                    (recur (pb (if has-rest
                                 (conj ret
                                       gfirst `(~first ~gseq)
                                       gseq `(~next ~gseq))
                                 ret)
                               firstb
                               (if has-rest
                                 gfirst
                                 (list nth gvec n nil)))
                           (inc n)
                           (next bs)
                           seen-rest?))))
        ret))))

(defn pb [bvec b v]
  (cond
    (symbol? b) (-> bvec (conj (if (namespace b)
                                 (symbol (name b)) b)) (conj v))
    (keyword? b) (-> bvec (conj (symbol (name b))) (conj v))
    (vector? b) (pvec bvec b v)
    (map? b) (pmap bvec b v)
    :else (throw (str "Unsupported binding form: " b))))

(defn ret [gmap bvec b v]
  (-> bvec (conj gmap) (conj v)
      (conj gmap) (conj (list 'if (list seq? gmap)
                              `(clojure.core/seq-to-map-for-destructuring ~gmap)
                              gmap))
      ((fn [ret]
         (if (:as b)
           (conj ret (:as b) gmap)
           ret)))))

(defn bes [b]
  (let [transforms
        (reduce
         (fn [transforms mk]
           (if (keyword? mk)
             (let [mkns (namespace mk)
                   mkn (name mk)]
               (cond (= mkn "keys") (assoc transforms mk #(keyword (or mkns (namespace %)) (name %)))
                     (= mkn "syms") (assoc transforms mk #(list `quote (symbol (or mkns (namespace %)) (name %))))
                     (= mkn "strs") (assoc transforms mk str)
                     :else transforms))
             transforms))
         {}
         (keys b))]
    (reduce
     (fn [bes entry]
       (reduce #(assoc %1 %2 ((val entry) %2))
               (dissoc bes (key entry))
               ((key entry) bes)))
     (dissoc b :as :or)
     transforms)))

(defn pmap [bvec b v]
  (let [gmap (gensym "map__")
        defaults (:or b)]
    (loop [ret (ret gmap bvec b v)
           bes (bes b)]
      (if (seq bes)
        (let [bb (key (first bes))
              bk (val (first bes))
              local (if #?(:clj  (instance? clojure.lang.Named bb)
                           :cljs (implements? INamed bb))
                      (with-meta (symbol nil (name bb)) (meta bb))
                      bb)
              bv (if (contains? defaults local)
                   (list `get gmap bk (defaults local))
                   (list `get gmap bk))]
          (recur
           (if (or (keyword? bb) (symbol? bb)) ;(ident? bb)
             (-> ret (conj local bv))
             (pb ret bb bv))
           (next bes)))
        ret))))

(defn destructure [bindings]
  (let [bents (partition 2 bindings)
        process-entry (fn [bvec b] (pb bvec (first b) (second b)))]
    (if (every? symbol? (map first bents))
      bindings
      (if-let [kwbs (seq (filter #(keyword? (first %)) bents))]
        (throw (str "Unsupported binding key: " (ffirst kwbs)))
        (reduce process-entry [] bents)))))

(destructure '[[a b] [1 2]])

(def client {:name "Super Co."
             :location "Philadelphia"
             :description "The worldwide leader in plastic tableware."})

(destructure '[{name :name
                location :location
                description :description} client])

