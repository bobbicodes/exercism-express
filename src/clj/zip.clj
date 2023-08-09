(ns clj.zip)

(defn zip/from-trail [tree last]
  (if (= (nth last 0) "left")
    {:value (nth last 1), :left tree, :right (nth last 2)}
    {:value (nth last 1), :left (nth last 2), :right tree}))

(defn zip/from-tree [tree]
  {:tree tree :trail []})

(defn zip/value [z]
  (:value (:tree z)))

(defn zip/zipper [tree trail]
  {:tree tree :trail trail})

(defn zip/left [z]
  (when (:left (:tree z))
    (zip/zipper (:left (:tree z))
            (conj [["left" (:value (:tree z)) (:right (:tree z))]]
                  (:trail z)))))
(defn zip/right [z]
  (when (:right (:tree z))
    (zip/zipper (:right (:tree z))
            (conj [["right" (:value (:tree z)) (:left (:tree z))]]
                  (:trail z)))))

(defn zip/rebuild-tree [tree trail]
  (if (= 0 (count trail))
    tree
    (recur (zip/from-trail tree (first trail)) (fnext trail))))

(defn zip/to-tree [z]
  (zip/rebuild-tree (:tree z) (:trail z)))

(defn zip/up [z]
  (when-not (zero? (count (:trail z)))
    (zip/zipper (zip/from-trail (:tree z) (first (:trail z)))
            (fnext (:trail z)))))

(defn zip/set-value [z value]
  (zip/zipper {:value value,
           :left  (:left (:tree z)),
           :right (:right (:tree z))}
          (:trail z)))

(defn zip/set-left [z left]
  (zip/zipper {:value (:value (:tree z)),
           :left  left,
           :right (:right (:tree z))}
          (:trail z)))

(defn zip/set-right [z right]
  (zip/zipper {:value (:value (:tree z)),
           :left  (:left (:tree z)),
           :right right}
          (:trail z)))