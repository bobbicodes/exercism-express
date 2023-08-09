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
         {:pretty true})))

(map not= [1 2 3] ["a" "b" "c"])

(defn destructure* [bindings]
  (let [bents (partition 2 bindings)
        pb (fn pb [bvec b v]
             (let [pvec
                   (fn [bvec b val]
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
                                       (throw #?(:clj (new Exception "Unsupported binding form, only :as can follow & parameter")
                                                 :cljs (new js/Error "Unsupported binding form, only :as can follow & parameter")))
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
                   pmap
                   (fn [bvec b v]
                     (let [gmap (gensym "map__")
                           defaults (:or b)]
                       (loop [ret (-> bvec (conj gmap) (conj v)
                                      (conj gmap) (conj (list 'if (list seq? gmap)
                                                              `(clojure.core/seq-to-map-for-destructuring ~gmap)
                                                              gmap))
                                      ((fn [ret]
                                         (if (:as b)
                                           (conj ret (:as b) gmap)
                                           ret))))
                              bes (let [transforms
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
                                     transforms))]
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
                           ret))))]
               (cond
                 (symbol? b) (-> bvec (conj (if (namespace b)
                                              (symbol (name b)) b)) (conj v))
                 (keyword? b) (-> bvec (conj (symbol (name b))) (conj v))
                 (vector? b) (pvec bvec b v)
                 (map? b) (pmap bvec b v)
                 :else (throw
                        #?(:clj (new Exception (str "Unsupported binding form: " b))
                           :cljs (new js/Error (str "Unsupported binding form: " b)))))))
        process-entry (fn [bvec b] (pb bvec (first b) (second b)))]
    (if (every? symbol? (map first bents))
      bindings
      (if-let [kwbs (seq (filter #(keyword? (first %)) bents))]
        (throw
         #?(:clj (new Exception (str "Unsupported binding key: " (ffirst kwbs)))
            :cljs (new js/Error (str "Unsupported binding key: " (ffirst kwbs)))))
        (reduce process-entry [] bents)))))

(destructure* '[[[bind expr & mod-pairs]
                & [[_ next-expr] :as next-groups]]])

(def client {:name "Super Co."
             :location "Philadelphia"
             :description "The worldwide leader in plastic tableware."})

(destructure* '[{name :name
                location :location
                description :description} client])

(defn update-ranges
  "Applies `f` to each range in `state` (see `changeByRange`)"
  ([state f]
   (update-ranges state nil f))
  ([^js state tr-specs f]
   (->> (fn [range]
          (or (when-some [result (f range)]
                (map-cursor range state result))
              #js{:range range}))
        (.changeByRange state)
        (#(j/extend! % tr-specs))
        (.update state))))

(defn slurp [direction]
  (fn [^js state]
    (update-ranges
     state
     (j/fn [^:js {:as   range
                  :keys [from to empty]}]
       (when empty
         (when-let [parent
                    (n/closest (n/tree state from)
                               (every-pred n/coll?
                                           #(not
                                             (some-> % n/with-prefix n/right n/end-edge?))))]
           (when-let [target (first (remove n/line-comment? (n/rights (n/with-prefix parent))))]
             {:cursor/mapped from
              :changes       (let [edge (n/down-last parent)]
                               [{:from   (-> target n/end)
                                 :insert (n/name edge)}
                                (-> edge
                                    n/from-to
                                    (j/assoc! :insert " "))])})))))))

(fn [seq-exprs]
  (reduce (fn [groups [k v]]
            (if (keyword? k)
              (conj (pop groups) (conj (peek groups) [k v]))
              (conj groups [k v])))
          [] (partition 2 seq-exprs)))

(defmacro for [seq-exprs body-expr]
  (let [to-groups (fn [seq-exprs]
                    (reduce (fn [groups [k v]]
                              (if (keyword? k)
                                (conj (pop groups) (conj (peek groups) [k v]))
                                (conj groups [k v])))
                            [] (partition 2 seq-exprs)))
        emit-bind (fn emit-bind [[[bind expr & mod-pairs]
                                  & [[_ next-expr] :as next-groups]]]
                    (let [giter (gensym "iter__")
                          gxs (gensym "s__")
                          do-mod (fn do-mod [[[k v :as pair] & etc]]
                                   (cond
                                     (= k :let) `(let ~v ~(do-mod etc))
                                     (= k :while) `(when ~v ~(do-mod etc))
                                     (= k :when) `(if ~v
                                                    ~(do-mod etc)
                                                    (recur (rest ~gxs)))
                                     next-groups
                                     `(let [iterys# ~(emit-bind next-groups)
                                            fs# (seq (iterys# ~next-expr))]
                                        (if fs#
                                          (concat fs# (~giter (rest ~gxs)))
                                          (recur (rest ~gxs))))
                                     :else `(cons ~body-expr
                                                  (~giter (rest ~gxs)))))]
                      (if next-groups
                        #_"not the inner-most loop"
                        `(fn ~giter [~gxs]
                           (lazy-seq
                            (loop [~gxs ~gxs]
                              (when-first [~bind ~gxs]
                                ~(do-mod mod-pairs)))))
                        #_"inner-most loop"
                        (let [gi (gensym "i__")
                              gb (gensym "b__")
                              do-cmod (fn do-cmod [[[k v :as pair] & etc]]
                                        (cond
                                          (= k :let) `(let ~v ~(do-cmod etc))
                                          (= k :while) `(when ~v ~(do-cmod etc))
                                          (= k :when) `(if ~v
                                                         ~(do-cmod etc)
                                                         (recur
                                                          (unchecked-inc ~gi)))

                                          :else
                                          `(do (chunk-append ~gb ~body-expr)
                                               (recur (unchecked-inc ~gi)))))]
                          `(fn ~giter [~gxs]
                             (lazy-seq
                              (loop [~gxs ~gxs]
                                (when-let [~gxs (seq ~gxs)]
                                  (if (chunked-seq? ~gxs)
                                    (let [c# (chunk-first ~gxs)
                                          size# (int (count c#))
                                          ~gb (chunk-buffer size#)]
                                      (if (loop [~gi (int 0)]
                                            (if (< ~gi size#)
                                              (let [~bind (.nth c# ~gi)]
                                                ~(do-cmod mod-pairs))
                                              true))
                                        (chunk-cons
                                         (chunk ~gb)
                                         (~giter (chunk-rest ~gxs)))
                                        (chunk-cons (chunk ~gb) nil)))
                                    (let [~bind (first ~gxs)]
                                      ~(do-mod mod-pairs)))))))))))]
    `(let [iter# ~(emit-bind (to-groups seq-exprs))]
       (iter# ~(second seq-exprs)))))

(for [x [0 1 2 3 4 5]
      :let [y (* x 3)]
      :when (even? y)]
  y)



(defn to-groups [seq-exprs]
  (reduce (fn [groups binding]
            (if (keyword? (first binding))
              (conj (pop groups) 
                    (conj (peek groups) 
                          [(first binding) (last binding)]))
              (conj groups [(first binding) (last binding)])))
          [] (partition 2 seq-exprs)))

(let [[[[bind expr & mod-pairs]
        & [[_ next-expr] :as next-groups]]]]
  (to-groups '[x [1 2 3]
               y [1 2 3]
               :while (<= x y)
               z [1 2 3]]))

(let [giter  (gensym "iter__")
      gxs    (gensym "s__")
      do-mod (fn do-mod [[[k v :as pair] & etc]])])

(defn do-mod [[pair & etc]]
  (cond
    (= k :let) `(let ~v ~(do-mod etc))
    (= k :while) `(when ~v ~(do-mod etc))
    (= k :when) `(if ~v
                   ~(do-mod etc)
                   (recur (rest ~gxs)))
    next-groups
    `(let [iterys# ~(emit-bind next-groups)
           fs#     (seq (iterys# ~next-expr))]
       (if fs#
         (concat fs# (~giter (rest ~gxs)))
         (recur (rest ~gxs))))
    :else `(cons ~body-expr
                 (~giter (rest ~gxs)))))

(defmacro for [seq-exprs body-expr]
  (let [emit-bind 
        (fn emit-bind [[[bind expr & mod-pairs]
                        & [[_ next-expr] :as next-groups]]]
          (let [giter  (gensym "iter__")
                gxs    (gensym "s__")
                do-mod (fn do-mod [[[k v :as pair] & etc]]
                         (cond
                           (= k :let) `(let ~v ~(do-mod etc))
                           (= k :while) `(when ~v ~(do-mod etc))
                           (= k :when) `(if ~v
                                          ~(do-mod etc)
                                          (recur (rest ~gxs)))
                           next-groups
                           `(let [iterys# ~(emit-bind next-groups)
                                  fs#     (seq (iterys# ~next-expr))]
                              (if fs#
                                (concat fs# (~giter (rest ~gxs)))
                                (recur (rest ~gxs))))
                           :else `(cons ~body-expr
                                        (~giter (rest ~gxs)))))]
            (if next-groups
              #_"not the inner-most loop"
              `(fn ~giter [~gxs]
                 (lazy-seq
                  (loop [~gxs ~gxs]
                    (when-first [~bind ~gxs]
                      ~(do-mod mod-pairs)))))
              #_"inner-most loop"
              (let [gi      (gensym "i__")
                    gb      (gensym "b__")
                    do-cmod (fn do-cmod [[[k v :as pair] & etc]]
                              (cond
                                (= k :let) `(let ~v ~(do-cmod etc))
                                (= k :while) `(when ~v ~(do-cmod etc))
                                (= k :when) `(if ~v
                                               ~(do-cmod etc)
                                               (recur
                                                (unchecked-inc ~gi)))

                                :else
                                `(do (chunk-append ~gb ~body-expr)
                                     (recur (unchecked-inc ~gi)))))]
                `(fn ~giter [~gxs]
                   (lazy-seq
                    (loop [~gxs ~gxs]
                      (when-let [~gxs (seq ~gxs)]
                        (if (chunked-seq? ~gxs)
                          (let [c#           (chunk-first ~gxs)
                                size#        (int (count c#))
                                ~gb (chunk-buffer size#)]
                            (if (loop [~gi (int 0)]
                                  (if (< ~gi size#)
                                    (let [~bind (.nth c# ~gi)]
                                      ~(do-cmod mod-pairs))
                                    true))
                              (chunk-cons
                               (chunk ~gb)
                               (~giter (chunk-rest ~gxs)))
                              (chunk-cons (chunk ~gb) nil)))
                          (let [~bind (first ~gxs)]
                            ~(do-mod mod-pairs)))))))))))]
    `(let [iter# ~(emit-bind (to-groups seq-exprs))]
       (iter# ~(second seq-exprs)))))

 (for [x [0 1 2 3 4 5]
       :let [y (* x 3)]
       :when (even? y)]
   y)

 (for [x [0 1 2]
      y [0 1 2]]
  [x y])

(to-groups '[x [0 1 2]
            y [0 1 2]])

 [[[0 0] [0 1]]
  [[0 2] [1 0]] 
  [[1 1] [1 2]] 
  [[2 0] [2 1]]]
